// One profile (one channel) drawn by uPlot. Reports what the pointer does (hover, click, drag) to its owner and
// draws what it is told (cursor at a sample, x range, lap lines, highlighted stretch). Holds no ride state itself.

import uPlot from "uplot";
import type { ChannelDef } from "../model/channels";
import type { SampleRange } from "../model/types";
import { h } from "../ui/dom";
import { withAlpha, type ChartTheme } from "./chartTheme";
import type { XProjection } from "./xAxis";

export interface PaneInput {
  readonly def: ChannelDef;
  readonly colour: string;
  readonly x: XProjection;
  /** Display units, null where there is no value. */
  readonly y: (number | null)[];
  readonly height: number;
  readonly showXAxis: boolean;
  /** Writes an x tick; `step` is the distance between ticks (for the number of digits). */
  readonly formatX: (x: number, step: number) => string;
  readonly theme: ChartTheme;
  readonly lapStarts: readonly number[];
  /** The top pane numbers the lap lines. */
  readonly showLapNumbers: boolean;
}

export interface PaneEvents {
  hover(index: number | null): void;
  click(index: number): void;
  dragging(range: SampleRange | null): void;
  dragged(range: SampleRange): void;
  reset(): void;
}

const MIN_DRAG_PX = 5;

export class ChartPane {
  readonly element: HTMLElement;
  readonly value = h("span", { class: "pane__value" });
  private readonly plot: uPlot;
  private highlight: SampleRange | null = null;
  private pressed = false;

  constructor(private readonly input: PaneInput, private readonly events: PaneEvents, width: number, label: string) {
    const { def, colour, theme } = input;
    const host = h("div", { class: "pane__plot" });
    this.element = h("div", { class: "pane", "data-channel": def.key },
      h("div", { class: "pane__label" }, h("span", { class: "pane__swatch" }), h("span", { class: "pane__name" }, label), this.value),
      host);
    this.element.style.setProperty("--pane-colour", colour);
    const axisFont = theme.font;
    this.plot = new uPlot({
      width,
      height: input.height,
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { range: (_u, min, max) => paddedRange(min, max, def.key === "altitude" ? 10 : 0) },
      },
      axes: [
        {
          show: input.showXAxis, stroke: theme.muted, font: axisFont, size: 28, gap: 4,
          grid: { stroke: theme.grid, width: 1 }, ticks: { show: false },
          values: (_u, splits) => splits.map((v) => input.formatX(v, Math.abs((splits[1] ?? v + 1) - (splits[0] ?? v)))),
        },
        {
          stroke: theme.muted, font: axisFont, size: 46, gap: 4,
          grid: { stroke: theme.grid, width: 1 }, ticks: { show: false },
          values: (_u, splits) => splits.map((v) => String(Math.round(v * 10) / 10)),
        },
      ],
      series: [
        {},
        {
          stroke: colour, width: def.chart === "area" ? 1.5 : 1.25,
          fill: def.chart === "area" ? withAlpha(colour, 0.28) : undefined,
          points: { show: false }, spanGaps: true,
        },
      ],
      cursor: {
        y: false,
        points: { size: 9, width: 2, stroke: theme.surface, fill: colour },
        drag: { x: true, y: false, setScale: false, dist: MIN_DRAG_PX },
        bind: { dblclick: () => () => null },
      },
      select: { show: true, left: 0, top: 0, width: 0, height: 0 },
      hooks: {
        setCursor: [(u) => this.onCursor(u)],
        setSelect: [(u) => this.onSelect(u)],
        draw: [(u) => this.drawMarks(u)],
      },
    }, [Array.from(input.x.values), input.y], host);

    const over = this.plot.over;
    over.addEventListener("mousedown", () => {
      this.pressed = true;
      this.plot.syncRect(); // the page may have moved since uPlot measured the plot
    });
    window.addEventListener("mouseup", this.release);
    over.addEventListener("click", (e) => this.events.click(this.indexAtClient(e.clientX)));
    over.addEventListener("dblclick", () => this.events.reset());
  }

  get def(): ChannelDef {
    return this.input.def;
  }

  get over(): HTMLElement {
    return this.plot.over;
  }

  /** The sample under a client x coordinate (for touch and clicks). */
  indexAtClient(clientX: number): number {
    const left = clientX - this.plot.over.getBoundingClientRect().left;
    return this.input.x.indexAt(this.plot.posToVal(left, "x"));
  }

  /** Shows the cursor at a sample without telling the owner (it caused it). */
  showCursor(index: number | null): void {
    if (index === null) {
      this.plot.setCursor({ left: -10, top: -10 }, false);
      return;
    }
    const left = this.plot.valToPos(this.input.x.at(index), "x");
    const y = this.input.y[index];
    const top = y === null || y === undefined ? this.plot.over.clientHeight / 2 : this.plot.valToPos(y, "y");
    this.plot.setCursor({ left, top }, false);
  }

  showRange(range: SampleRange): void {
    const { x } = this.input;
    const min = x.at(range.from);
    const max = Math.max(x.at(range.to), min + 1e-6);
    this.plot.setScale("x", { min, max });
  }

  /** The band of a drag going on in another pane. */
  showDrag(range: SampleRange | null): void {
    if (!range) {
      this.plot.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
      return;
    }
    const a = this.plot.valToPos(this.input.x.at(range.from), "x");
    const b = this.plot.valToPos(this.input.x.at(range.to), "x");
    this.plot.setSelect({ left: Math.min(a, b), top: 0, width: Math.abs(b - a), height: this.plot.over.clientHeight }, false);
  }

  /** A stretch shaded faintly (lap/climb row under the pointer). */
  setHighlight(range: SampleRange | null): void {
    this.highlight = range;
    this.plot.redraw(false, false);
  }

  /** The current value written next to the pane's name. */
  setValueText(text: string): void {
    this.value.textContent = text;
  }

  resize(width: number): void {
    this.plot.setSize({ width, height: this.input.height });
  }

  destroy(): void {
    window.removeEventListener("mouseup", this.release);
    this.plot.destroy();
  }

  private readonly release = (): void => {
    this.pressed = false;
  };

  private onCursor(u: uPlot): void {
    const left = u.cursor.left ?? -1;
    if (this.pressed && u.select.width > MIN_DRAG_PX) {
      this.events.dragging(this.selectedRange(u));
    }
    this.events.hover(left < 0 ? null : this.input.x.indexAt(u.posToVal(left, "x")));
  }

  private onSelect(u: uPlot): void {
    const range = u.select.width > MIN_DRAG_PX ? this.selectedRange(u) : null;
    // The drag is over before anyone reacts: the zoom that follows must not be read as more dragging.
    this.pressed = false;
    u.setSelect({ left: 0, top: 0, width: 0, height: 0 }, false);
    if (range) this.events.dragged(range);
    else this.events.dragging(null);
  }

  private selectedRange(u: uPlot): SampleRange {
    const { x } = this.input;
    return { from: x.indexAt(u.posToVal(u.select.left, "x")), to: x.indexAt(u.posToVal(u.select.left + u.select.width, "x")) };
  }

  /** Lap lines with their numbers, and the highlighted stretch. */
  private drawMarks(u: uPlot): void {
    const { ctx } = u;
    const { left, top, width, height } = u.bbox;
    const { x, theme, lapStarts } = this.input;
    ctx.save();
    if (this.highlight) {
      const a = Math.max(left, u.valToPos(x.at(this.highlight.from), "x", true));
      const b = Math.min(left + width, u.valToPos(x.at(this.highlight.to), "x", true));
      ctx.fillStyle = theme.highlight;
      if (b > a) ctx.fillRect(a, top, b - a, height);
    }
    ctx.strokeStyle = theme.lap;
    ctx.fillStyle = theme.muted;
    ctx.lineWidth = devicePixelRatio;
    ctx.setLineDash([3 * devicePixelRatio, 3 * devicePixelRatio]);
    ctx.font = `${10 * devicePixelRatio}px system-ui`;
    lapStarts.forEach((index, n) => {
      if (n === 0) return;
      const px = u.valToPos(x.at(index), "x", true);
      if (px < left || px > left + width) return;
      ctx.beginPath();
      ctx.moveTo(px, top);
      ctx.lineTo(px, top + height);
      ctx.stroke();
      if (this.input.showLapNumbers) ctx.fillText(String(n + 1), px + 3 * devicePixelRatio, top + 11 * devicePixelRatio);
    });
    ctx.restore();
  }
}

/** The data's range with some air, rounded to `step` when given. */
function paddedRange(min: number | null, max: number | null, step: number): uPlot.Range.MinMax {
  if (min === null || max === null) return [0, 1];
  const pad = (max - min || Math.abs(max) || 1) * 0.08;
  let lo = min - pad;
  let hi = max + pad;
  if (min >= 0 && lo < 0) lo = 0;
  if (step > 0) {
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
  }
  return [lo, hi];
}
