// Laps, splits and climbs as one table with tabs: the same columns, fed with different lists of stretches.
// Pointing at a row outlines it on map and profiles; clicking zooms to it.

import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import type { SectionTab } from "../app/Preferences";
import type { Formatter } from "../i18n/format";
import type { TextKey } from "../i18n/de";
import { channelDef } from "../model/channels";
import { climbs, splits } from "../model/sections";
import { segmentStats, type SegmentStats } from "../model/segment";
import type { ActivityStreams, SampleRange } from "../model/types";
import { h, replaceChildren } from "../ui/dom";
import type { DetailSession } from "./DetailSession";
import { markZoomRows, zoomRow } from "./zoomRow";

interface Column {
  readonly headKey: TextKey;
  /** Only shown when the ride has the data. */
  readonly present: (s: ActivityStreams) => boolean;
  readonly cell: (stats: SegmentStats, range: SampleRange, s: ActivityStreams, fmt: Formatter) => string;
}

const COLUMNS: readonly Column[] = [
  { headKey: "detail.col.start", present: (s) => !!s.distance, cell: (_st, r, s, f) => f.km(s.distance![r.from]!) },
  { headKey: "detail.col.length", present: (s) => !!s.distance, cell: (st, _r, _s, f) => f.distance(st.distance) },
  { headKey: "detail.col.time", present: () => true, cell: (st, _r, _s, f) => f.duration(st.movingTime) },
  { headKey: "detail.col.speed", present: (s) => !!s.channels.speed, cell: (st, _r, _s, f) => num(st.channels.speed?.mean, (v) => f.channel(channelDef("speed"), v, false)) },
  { headKey: "detail.col.ascent", present: (s) => !!s.channels.altitude, cell: (st, _r, _s, f) => f.number(st.ascent) },
  { headKey: "detail.col.gradient", present: (s) => !!s.channels.altitude && !!s.distance,
    cell: (st, r, s, f) => (st.distance > 0 ? f.number(((s.channels.altitude![r.to]! - s.channels.altitude![r.from]!) / st.distance) * 100, 1) : "–") },
  { headKey: "detail.col.heartRate", present: (s) => !!s.channels.heartRate, cell: (st, _r, _s, f) => num(st.channels.heartRate?.mean, (v) => f.number(v)) },
  { headKey: "detail.col.power", present: (s) => !!s.channels.power, cell: (st, _r, _s, f) => num(st.channels.power?.mean, (v) => f.number(v)) },
];

const num = (v: number | undefined, write: (v: number) => string): string => (v === undefined ? "–" : write(v));

interface TabDef {
  readonly tab: SectionTab;
  readonly labelKey: TextKey;
  readonly kind: "lap" | "split" | "climb";
  readonly ranges: (s: ActivityStreams, splitKm: number) => SampleRange[];
  readonly emptyKey: TextKey;
}

const TABS: readonly TabDef[] = [
  { tab: "laps", labelKey: "detail.laps", kind: "lap", ranges: (s) => [...s.laps], emptyKey: "detail.noLaps" },
  { tab: "splits", labelKey: "detail.splits", kind: "split", ranges: (s, km) => splits(s.distance, km), emptyKey: "detail.noSplits" },
  { tab: "climbs", labelKey: "detail.climbs", kind: "climb", ranges: (s) => climbs(s), emptyKey: "detail.noClimbs" },
];

export class SectionsTable {
  readonly element = h("section", { class: "sections" });
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    this.disposer.add(
      ctx.prefs.on("changed", (key) => { if (key === "sectionTab" || key === "splitKm") this.render(); }),
      session.on("view", (v) => { if (!v.live) this.markActive(); }),
    );
    this.render();
  }

  dispose(): void {
    this.disposer.dispose();
  }

  private render(): void {
    const { ctx, session } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const { streams } = session;
    const splitKm = ctx.prefs.get("splitKm");
    const available = TABS.filter((d) => d.tab !== "laps" || streams.laps.length > 1).filter((d) => d.tab !== "splits" || streams.distance);
    const chosen = available.find((d) => d.tab === ctx.prefs.get("sectionTab")) ?? available[0];
    if (!chosen) {
      this.element.hidden = true;
      return;
    }
    const ranges = chosen.ranges(streams, splitKm);
    const columns = COLUMNS.filter((c) => c.present(streams));
    replaceChildren(this.element,
      h("header", { class: "sections__head" },
        h("div", { class: "tabs", role: "tablist" }, available.map((d) => h("button", {
          type: "button", role: "tab", class: "tabs__tab", "aria-selected": String(d === chosen), onclick: () => ctx.prefs.set("sectionTab", d.tab),
        }, t(d.labelKey)))),
        chosen.tab === "splits"
          ? h("div", { class: "segmented segmented--small", role: "radiogroup", "aria-label": t("detail.splitLength") },
              ([1, 5, 10] as const).map((km) => h("button", {
                type: "button", role: "radio", class: "segmented__option", "aria-checked": String(km === splitKm), onclick: () => ctx.prefs.set("splitKm", km),
              }, `${km} km`)))
          : null),
      ranges.length === 0
        ? h("p", { class: "sections__empty" }, t(chosen.emptyKey))
        : h("div", { class: "table-scroll" }, h("table", { class: "table" },
            h("thead", {}, h("tr", {}, h("th", {}, t("detail.col.number")), columns.map((c) => h("th", {}, t(c.headKey))), h("th", {}, ""))),
            h("tbody", {}, ranges.map((range, i) => this.row(chosen, range, i, columns))))),
    );
    this.markActive();
  }

  private row(tab: TabDef, range: SampleRange, i: number, columns: readonly Column[]): HTMLElement {
    const { session, ctx } = this;
    const stats = segmentStats(session.streams, range);
    return zoomRow(session, range, { kind: tab.kind, n: i + 1 },
      [i + 1, ...columns.map((c) => c.cell(stats, range, session.streams, ctx.i18n.fmt))], ctx.i18n.t.bind(ctx.i18n));
  }

  private markActive(): void {
    markZoomRows(this.element, this.session, this.ctx.i18n.t.bind(this.ctx.i18n));
  }
}
