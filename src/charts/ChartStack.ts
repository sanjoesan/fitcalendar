// The stack of profiles under one x axis. Turns what the pointer does in any pane into session calls, and session
// events into what every pane shows: the cursor at the same sample everywhere, the same zoom, the drag band.

import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import type { DetailSession } from "../detail/DetailSession";
import { CHANNELS, type ChannelDef } from "../model/channels";
import { segmentStats } from "../model/segment";
import { smooth } from "../model/smooth";
import { h, replaceChildren, cssVar } from "../ui/dom";
import { onThemeChange } from "../ui/theme";
import { ChartPane } from "./ChartPane";
import { readChartTheme } from "./chartTheme";
import { attachTouch } from "./touch";
import { XProjection } from "./xAxis";

const PANE_HEIGHT = 120;
const AREA_HEIGHT = 150;
const PHONE_PANE_HEIGHT = 100;

export function visibleChannels(ctx: AppContext, session: DetailSession): ChannelDef[] {
  const shown = ctx.prefs.get("channelShown");
  return CHANNELS.filter((c) => session.streams.channels[c.key] && (shown[c.key] ?? c.onByDefault));
}

export class ChartStack {
  readonly element = h("div", { class: "charts", tabindex: 0 });
  private readonly cursorLabel = h("div", { class: "charts__cursor", "aria-hidden": "true" });
  private readonly panesHost = h("div", { class: "charts__panes" });
  private panes: ChartPane[] = [];
  private x!: XProjection;
  private readonly disposer = new Disposer();
  private readonly paneCleanups: (() => void)[] = [];
  /** Set while the stack itself moves cursors, so the panes' hover reports are not taken as user input. */
  private applying = false;

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    this.element.setAttribute("aria-label", ctx.i18n.t("detail.chartsLabel"));
    this.element.append(this.cursorLabel, this.panesHost);
    this.disposer.add(
      session.on("cursor", (c) => { if (c.origin !== "chart") this.showCursor(c.index); else this.updateLabels(c.index); }),
      session.on("view", (v) => { this.withApplying(() => this.panes.forEach((p) => p.showRange(v.range))); this.updateLabels(session.cursor.index); }),
      session.on("preview", (p) => { if (p.origin !== "chart") this.panes.forEach((pane) => pane.showDrag(p.range)); }),
      session.on("section", (range) => this.panes.forEach((p) => p.setHighlight(range))),
      session.on("axis", () => this.build()),
      ctx.prefs.on("changed", (key) => { if (key === "channelShown" || key === "smoothing") this.build(); }),
      onThemeChange(ctx.prefs, () => this.build()),
    );
    const observer = new ResizeObserver(() => this.panes.forEach((p) => p.resize(this.width())));
    observer.observe(this.element);
    this.disposer.add(() => observer.disconnect());
    this.disposer.listen(this.element, "keydown", (e) => this.onKey(e));
  }

  /** (Re)creates the panes - on start, axis, channel, smoothing or theme change. */
  build(): void {
    this.destroyPanes();
    const { ctx, session } = this;
    const { streams } = session;
    const t = ctx.i18n.t.bind(ctx.i18n);
    this.x = new XProjection(session.axis, streams);
    const theme = readChartTheme();
    const channels = visibleChannels(ctx, session);
    const phone = matchMedia("(max-width: 699px)").matches;
    const smoothing = ctx.prefs.get("smoothing");
    const lapStarts = streams.laps.map((l) => l.from);
    this.panes = channels.map((def, i) => {
      const raw = streams.channels[def.key]!;
      const values = def.smoothable ? smooth(streams.time, raw, smoothing) : raw;
      const y = Array.from(values, (v) => (Number.isNaN(v) ? null : def.display(v)));
      const pane = new ChartPane({
        def, colour: cssVar(def.colour), x: this.x, y, theme, lapStarts,
        height: phone ? PHONE_PANE_HEIGHT : def.chart === "area" ? AREA_HEIGHT : PANE_HEIGHT,
        showXAxis: i === channels.length - 1,
        showLapNumbers: i === 0,
        formatX: (v, step) => this.formatX(v, step),
      }, {
        hover: (index) => { if (!this.applying) session.setHover(index, "chart"); this.mirrorCursor(pane, index); },
        click: (index) => (session.cursor.pinned !== null && Math.abs(session.cursor.pinned - index) < 2 ? session.unpin("chart") : session.pin(index, "chart")),
        dragging: (range) => {
          if (this.applying) return;
          session.setPreview(range, "chart");
          this.panes.forEach((p) => p !== pane && p.showDrag(range));
        },
        dragged: (range) => { this.panes.forEach((p) => p.showDrag(null)); session.zoomTo(range, "chart"); },
        reset: () => session.resetZoom("chart"),
      }, this.width(), `${t(def.labelKey)} (${t(def.unitKey)})`);
      this.paneCleanups.push(attachTouch(pane.over, {
        indexAt: (clientX) => pane.indexAtClient(clientX),
        scrub: (index) => session.setHover(index, "touch"),
        tap: (index) => session.pin(index, "touch"),
        selecting: (from, to) => session.setPreview({ from, to }, "touch"),
        selected: (from, to) => session.zoomTo({ from, to }, "touch"),
      }));
      return pane;
    });
    replaceChildren(this.panesHost, this.panes.map((p) => p.element));
    this.withApplying(() => this.panes.forEach((p) => p.showRange(session.view)));
    this.showCursor(session.cursor.index);
  }

  dispose(): void {
    this.disposer.dispose();
    this.destroyPanes();
  }

  private destroyPanes(): void {
    this.paneCleanups.splice(0).forEach((c) => c());
    this.panes.forEach((p) => p.destroy());
    this.panes = [];
  }

  private width(): number {
    return Math.max(200, this.panesHost.clientWidth || this.element.clientWidth || 600);
  }

  private withApplying(run: () => void): void {
    this.applying = true;
    try { run(); } finally { this.applying = false; }
  }

  /** All panes show the cursor at the sample (input from map, keyboard, touch, pin). */
  private showCursor(index: number | null): void {
    this.withApplying(() => this.panes.forEach((p) => p.showCursor(index)));
    this.updateLabels(index);
  }

  /** The pane under the mouse draws its own cursor; the others follow it. */
  private mirrorCursor(source: ChartPane, index: number | null): void {
    if (this.applying) return;
    const shown = index ?? this.session.cursor.pinned;
    this.withApplying(() => this.panes.forEach((p) => (p !== source || index === null) && p.showCursor(shown)));
  }

  /** The values next to each pane's name, and the floating position label. */
  private updateLabels(index: number | null): void {
    const { fmt } = this.ctx.i18n;
    const { streams } = this.session;
    const means = index === null ? segmentStats(streams, this.session.view).channels : null;
    for (const pane of this.panes) {
      const { def } = pane;
      const raw = streams.channels[def.key]!;
      if (index !== null) {
        const v = raw[index]!;
        pane.setValueText(Number.isNaN(v) ? "–" : fmt.channel(def, v));
      } else {
        const mean = means?.[def.key]?.mean;
        pane.setValueText(mean === undefined ? "" : `Ø ${fmt.channel(def, mean)}`);
      }
    }
    if (index === null) {
      this.cursorLabel.hidden = true;
      return;
    }
    const parts = [streams.distance ? fmt.distance(streams.distance[index]!) : null, fmt.duration(streams.time[index]!)].filter(Boolean);
    this.cursorLabel.textContent = parts.join(" · ");
    this.cursorLabel.hidden = false;
    const pane = this.panes[0];
    if (pane) {
      const over = pane.over.getBoundingClientRect();
      const host = this.element.getBoundingClientRect();
      const { from, to } = this.session.view;
      const fraction = (this.x.at(index) - this.x.at(from)) / (this.x.at(to) - this.x.at(from) || 1);
      this.cursorLabel.style.insetInlineStart = `${over.left - host.left + fraction * over.width}px`;
    }
  }

  private formatX(v: number, step: number): string {
    const { fmt } = this.ctx.i18n;
    if (this.session.axis === "distance") return fmt.number(v, step >= 1 ? 0 : step >= 0.1 ? 1 : 2);
    return step >= 60 ? fmt.hoursMinutes(v) : fmt.duration(v);
  }

  /** ←/→ one sample, Shift 1 km / 1 min, Home/End the view's ends, Enter pins, Esc unpins then zooms out, Backspace zooms back. */
  private onKey(e: KeyboardEvent): void {
    const { session } = this;
    const at = session.cursor.index ?? session.view.from;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowRight": {
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        session.step(e.shiftKey ? this.x.bigStep(at, dir) : dir, "keyboard");
        break;
      }
      case "Home": session.setHover(session.view.from, "keyboard"); break;
      case "End": session.setHover(session.view.to, "keyboard"); break;
      case "Enter": session.pin(at, "keyboard"); break;
      case "Escape":
        if (session.cursor.pinned !== null) session.unpin("keyboard");
        else session.resetZoom("keyboard");
        break;
      case "Backspace": session.zoomBack("keyboard"); break;
      default: return;
    }
    e.preventDefault();
    e.stopPropagation(); // the page's own Esc/Backspace handling must not act a second time
  }
}
