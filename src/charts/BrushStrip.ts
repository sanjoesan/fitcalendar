// The whole ride in small under the profiles, with the visible stretch as a window: drag the window to pan,
// drag an edge to resize, drag outside to draw a new stretch.

import { Disposer } from "../app/Emitter";
import type { DetailSession } from "../detail/DetailSession";
import { CHANNELS } from "../model/channels";
import type { SampleRange } from "../model/types";
import { h } from "../ui/dom";
import { XProjection } from "./xAxis";

const SVG_NS = "http://www.w3.org/2000/svg";
const EDGE_PX = 10;
const POINTS = 400;

export class BrushStrip {
  readonly element = h("div", { class: "brush", role: "slider" });
  private readonly svg = document.createElementNS(SVG_NS, "svg");
  private readonly area = document.createElementNS(SVG_NS, "path");
  private readonly window = h("div", { class: "brush__window" });
  private x!: XProjection;
  private readonly disposer = new Disposer();

  constructor(private readonly session: DetailSession, label: string) {
    this.element.setAttribute("aria-label", label);
    this.svg.setAttribute("class", "brush__svg");
    this.svg.setAttribute("preserveAspectRatio", "none");
    this.svg.setAttribute("viewBox", `0 0 ${POINTS} 100`);
    this.area.setAttribute("class", "brush__area");
    this.svg.append(this.area);
    this.window.append(h("span", { class: "brush__handle brush__handle--start" }), h("span", { class: "brush__handle brush__handle--end" }));
    this.element.append(this.svg, this.window);
    this.disposer.add(
      session.on("view", (v) => this.place(v.range)),
      session.on("axis", () => this.draw()),
    );
    this.wire();
    this.draw();
  }

  dispose(): void {
    this.disposer.dispose();
  }

  private draw(): void {
    const { streams } = this.session;
    this.x = new XProjection(this.session.axis, streams);
    const key = CHANNELS.find((c) => streams.channels[c.key])?.key;
    const values = key ? streams.channels[key]! : null;
    const n = streams.time.length;
    const x0 = this.x.at(0);
    const span = this.x.at(n - 1) - x0 || 1;
    let lo = Infinity;
    let hi = -Infinity;
    const samples: [number, number][] = [];
    for (let p = 0; p <= POINTS; p++) {
      const i = this.x.indexAt(x0 + (p / POINTS) * span);
      const v = values ? values[i]! : 1;
      if (Number.isNaN(v)) continue;
      samples.push([p, v]);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    const y = (v: number) => 96 - ((v - lo) / (hi - lo || 1)) * 80;
    const d = samples.map(([p, v], i) => `${i ? "L" : "M"}${p},${y(v).toFixed(1)}`).join("");
    this.area.setAttribute("d", samples.length ? `${d}L${POINTS},100L0,100Z` : "");
    this.place(this.session.view);
  }

  private fraction(index: number): number {
    const n = this.session.streams.time.length;
    return (this.x.at(index) - this.x.at(0)) / (this.x.at(n - 1) - this.x.at(0) || 1);
  }

  private place(range: SampleRange): void {
    const a = this.fraction(range.from);
    const b = this.fraction(range.to);
    this.window.style.insetInlineStart = `${a * 100}%`;
    this.window.style.inlineSize = `${Math.max(0.5, (b - a) * 100)}%`;
    this.window.classList.toggle("brush__window--whole", !this.session.isZoomed);
  }

  private indexAt(clientX: number): number {
    const r = this.element.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    const n = this.session.streams.time.length;
    return this.x.indexAt(this.x.at(0) + fraction * (this.x.at(n - 1) - this.x.at(0)));
  }

  private wire(): void {
    type Drag = { mode: "move" | "start" | "end" | "new"; anchor: number; startView: SampleRange; startX: number; moved: boolean };
    let drag: Drag | null = null;
    const rangeFor = (clientX: number): SampleRange => {
      const d = drag!;
      const i = this.indexAt(clientX);
      if (d.mode === "new") return { from: Math.min(d.anchor, i), to: Math.max(d.anchor, i) };
      if (d.mode === "start") return { from: Math.min(i, d.startView.to - 1), to: d.startView.to };
      if (d.mode === "end") return { from: d.startView.from, to: Math.max(i, d.startView.from + 1) };
      const shift = i - d.anchor;
      const last = this.session.whole.to;
      const len = d.startView.to - d.startView.from;
      const from = Math.max(0, Math.min(last - len, d.startView.from + shift));
      return { from, to: from + len };
    };
    this.element.addEventListener("pointerdown", (e) => {
      const w = this.window.getBoundingClientRect();
      const mode: Drag["mode"] = !this.session.isZoomed ? "new"
        : Math.abs(e.clientX - w.left) < EDGE_PX ? "start"
        : Math.abs(e.clientX - w.right) < EDGE_PX ? "end"
        : e.clientX > w.left && e.clientX < w.right ? "move" : "new";
      drag = { mode, anchor: this.indexAt(e.clientX), startView: this.session.view, startX: e.clientX, moved: false };
      this.element.setPointerCapture(e.pointerId);
      this.element.classList.add("brush--dragging");
      e.preventDefault();
    });
    this.element.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.moved) {
        if (Math.abs(e.clientX - drag.startX) < 3) return;
        // the first real movement: one history step for the whole drag
        if (drag.mode === "new") this.session.zoomTo(rangeFor(e.clientX), "brush");
        else this.session.beginPan();
        drag.moved = true;
      }
      this.session.panTo(rangeFor(e.clientX), "brush", true);
    });
    const end = (e: PointerEvent) => {
      if (!drag) return;
      if (drag.moved) this.session.panTo(rangeFor(e.clientX), "brush", false);
      drag = null;
      this.element.classList.remove("brush--dragging");
    };
    this.element.addEventListener("pointerup", end);
    this.element.addEventListener("pointercancel", end);
    this.element.addEventListener("dblclick", () => this.session.resetZoom("brush"));
  }
}
