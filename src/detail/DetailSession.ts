// The interactive state of one open ride - the only owner of it:
//   cursor   the sample under the pointer (or keyboard), and a pinned sample
//   view     the visible stretch (zoom), with a stack for "zoom back"
//   preview  a stretch being dragged out, before it becomes the view
//   section  a lap/split/climb row under the pointer
// Charts, map, tiles, tables and the address all subscribe; every event says which input caused it, so the
// input that caused it does not react to its own echo.

import type { XAxis } from "../app/Preferences";
import { Emitter } from "../app/Emitter";
import type { ActivityStreams, ActivitySummary, SampleRange } from "../model/types";

export type Origin = "chart" | "touch" | "map" | "keyboard" | "brush" | "section" | "toolbar" | "url";

/** What a view is, when it is a named stretch rather than a dragged one. */
export type ViewLabel =
  | { readonly kind: "lap" | "split" | "climb"; readonly n: number }
  | { readonly kind: "effort"; readonly duration: number };

export interface CursorState {
  /** The sample shown: the hovered one, else the pinned one. */
  readonly index: number | null;
  readonly pinned: number | null;
  readonly hovering: boolean;
  readonly origin: Origin;
}

export interface ViewState {
  readonly range: SampleRange;
  readonly label: ViewLabel | null;
  readonly zoomed: boolean;
  readonly canZoomBack: boolean;
  /** True while a brush drag is still moving: cheap reactions only (no map fit, no address change). */
  readonly live: boolean;
  readonly origin: Origin;
}

interface ViewEntry {
  readonly range: SampleRange;
  readonly label: ViewLabel | null;
}

export interface SessionEvents {
  cursor: CursorState;
  view: ViewState;
  preview: { readonly range: SampleRange | null; readonly origin: Origin };
  section: SampleRange | null;
  axis: XAxis;
}

/** The smallest stretch that can be a view. */
const MIN_SAMPLES = 2;

export class DetailSession extends Emitter<SessionEvents> {
  readonly whole: SampleRange;
  private hover: number | null = null;
  private pinnedIndex: number | null = null;
  private stack: ViewEntry[];
  private previewRange: SampleRange | null = null;
  private currentAxis: XAxis;

  constructor(readonly summary: ActivitySummary, readonly streams: ActivityStreams, axis: XAxis, initialView: SampleRange | null) {
    super();
    this.whole = { from: 0, to: streams.time.length - 1 };
    this.currentAxis = streams.distance ? axis : "time";
    const start = initialView && this.normalise(initialView);
    this.stack = start && !this.isWhole(start) ? [{ range: this.whole, label: null }, { range: start, label: null }] : [{ range: this.whole, label: null }];
  }

  // ---- cursor ------------------------------------------------------------------------------------------------
  get cursor(): CursorState {
    return { index: this.hover ?? this.pinnedIndex, pinned: this.pinnedIndex, hovering: this.hover !== null, origin: "url" };
  }

  setHover(index: number | null, origin: Origin): void {
    const next = index === null ? null : this.clampIndex(index);
    if (next === this.hover) return;
    this.hover = next;
    this.emitCursor(origin);
  }

  pin(index: number, origin: Origin): void {
    this.pinnedIndex = this.clampIndex(index);
    this.emitCursor(origin);
  }

  unpin(origin: Origin): void {
    if (this.pinnedIndex === null) return;
    this.pinnedIndex = null;
    this.emitCursor(origin);
  }

  /** Moves the shown sample by `step` (keyboard); it becomes the hover position. */
  step(step: number, origin: Origin): void {
    const base = this.hover ?? this.pinnedIndex ?? this.view.from;
    const { from, to } = this.view;
    this.setHover(Math.max(from, Math.min(to, base + step)), origin);
  }

  // ---- view (zoom) -------------------------------------------------------------------------------------------
  get view(): SampleRange {
    return this.top.range;
  }

  get viewState(): ViewState {
    return this.stateOf("url", false);
  }

  get isZoomed(): boolean {
    return !this.isWhole(this.view);
  }

  /** Zooms into a stretch (drag, lap, climb, best effort); "zoom back" returns to the view before. */
  zoomTo(range: SampleRange, origin: Origin, label: ViewLabel | null = null): void {
    const r = this.normalise(range);
    if (!r) return;
    this.previewRange = null;
    this.emit("preview", { range: null, origin });
    this.stack.push({ range: r, label });
    this.emitView(origin, false);
  }

  /** Starts moving the view with the brush: the stretch before the move becomes one "zoom back" step. */
  beginPan(): void {
    this.stack.push({ ...this.top });
  }

  /** Moves the current view without a new history step (brush drag). `live`: the drag is still going on. */
  panTo(range: SampleRange, origin: Origin, live: boolean): void {
    const r = this.normalise(range);
    if (!r) return;
    this.stack[this.stack.length - 1] = { range: r, label: null };
    this.emitView(origin, live);
  }

  zoomBack(origin: Origin): void {
    if (this.stack.length <= 1) return;
    this.stack.pop();
    this.emitView(origin, false);
  }

  resetZoom(origin: Origin): void {
    if (this.stack.length === 1 && !this.isZoomed) return;
    this.stack = [{ range: this.whole, label: null }];
    this.emitView(origin, false);
  }

  // ---- preview, section hover, axis --------------------------------------------------------------------------
  get preview(): SampleRange | null {
    return this.previewRange;
  }

  setPreview(range: SampleRange | null, origin: Origin): void {
    this.previewRange = range ? this.normalise(range) : null;
    this.emit("preview", { range: this.previewRange, origin });
  }

  hoverSection(range: SampleRange | null): void {
    this.emit("section", range);
  }

  get axis(): XAxis {
    return this.currentAxis;
  }

  /** Rides without distance only have the time axis. */
  get canUseDistance(): boolean {
    return this.streams.distance !== null;
  }

  setAxis(axis: XAxis): void {
    const next = this.canUseDistance ? axis : "time";
    if (next === this.currentAxis) return;
    this.currentAxis = next;
    this.emit("axis", next);
  }

  // ---- internals ---------------------------------------------------------------------------------------------
  private get top(): ViewEntry {
    return this.stack[this.stack.length - 1]!;
  }

  private stateOf(origin: Origin, live: boolean): ViewState {
    return { range: this.view, label: this.top.label, zoomed: this.isZoomed, canZoomBack: this.stack.length > 1, live, origin };
  }

  private emitView(origin: Origin, live: boolean): void {
    this.emit("view", this.stateOf(origin, live));
  }

  private emitCursor(origin: Origin): void {
    this.emit("cursor", { ...this.cursor, origin });
  }

  private isWhole(r: SampleRange): boolean {
    return r.from <= this.whole.from && r.to >= this.whole.to;
  }

  private clampIndex(i: number): number {
    return Math.max(this.whole.from, Math.min(this.whole.to, Math.round(i)));
  }

  private normalise(range: SampleRange): SampleRange | null {
    const from = this.clampIndex(Math.min(range.from, range.to));
    const to = this.clampIndex(Math.max(range.from, range.to));
    return to - from + 1 >= MIN_SAMPLES ? { from, to } : null;
  }
}
