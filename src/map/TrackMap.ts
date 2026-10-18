// The ride on an OpenStreetMap map (Leaflet): the track - plain or coloured by a channel -, start and finish, the
// cursor marker that follows the profiles, and the highlighted stretch of the view, a drag or a table row.
// Hovering the track moves the cursor; clicking pins it; Shift+click with a pin zooms to the stretch between.

import L from "leaflet";
import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import type { DetailSession } from "../detail/DetailSession";
import { CHANNELS, channelDef } from "../model/channels";
import type { ChannelKey, SampleRange } from "../model/types";
import { cssVar, h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { onThemeChange } from "../ui/theme";
import { binOf, rampFor, BINS } from "./colourRamp";
import { TrackIndex } from "./TrackIndex";

const HOVER_RADIUS_PX = 24;
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export class TrackMap {
  readonly element = h("div", { class: "map" });
  private readonly canvas = h("div", { class: "map__canvas" });
  private readonly controls = h("div", { class: "map__controls" });
  private readonly legend = h("div", { class: "map__legend", hidden: true });
  private readonly map: L.Map;
  private readonly renderer = L.canvas({ padding: 0.4 });
  private readonly index: TrackIndex;
  private readonly lat: Float64Array;
  private readonly lon: Float64Array;
  private trackLayer = L.layerGroup();
  private readonly highlightLayer = L.layerGroup();
  private readonly sectionLayer = L.layerGroup();
  private readonly cursor: L.CircleMarker;
  private readonly pinMarker: L.CircleMarker;
  private readonly disposer = new Disposer();
  private hoverFromMap = false;

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    this.lat = session.streams.lat!;
    this.lon = session.streams.lon!;
    this.index = new TrackIndex(this.lat, this.lon);
    this.element.append(this.canvas, this.controls, this.legend);
    this.map = L.map(this.canvas, { preferCanvas: true, zoomControl: true, attributionControl: true, scrollWheelZoom: true });
    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(this.map);
    this.map.attributionControl.setPrefix(false);
    const start = this.firstFix(1);
    const finish = this.firstFix(-1);
    // Layers need a view to draw into; the real fit follows once the map has its size.
    this.map.setView([this.lat[start]!, this.lon[start]!], 13);
    this.trackLayer.addTo(this.map);
    this.sectionLayer.addTo(this.map);
    this.highlightLayer.addTo(this.map);
    L.circleMarker([this.lat[start]!, this.lon[start]!], { renderer: this.renderer, radius: 6, color: "#fff", weight: 2, fillColor: cssVar("--cypress"), fillOpacity: 1 })
      .bindTooltip(ctx.i18n.t("detail.start")).addTo(this.map);
    L.circleMarker([this.lat[finish]!, this.lon[finish]!], { renderer: this.renderer, radius: 6, color: "#fff", weight: 2, fillColor: cssVar("--terracotta"), fillOpacity: 1 })
      .bindTooltip(ctx.i18n.t("detail.finish")).addTo(this.map);
    this.pinMarker = L.circleMarker([0, 0], { renderer: this.renderer, radius: 6, color: "#fff", weight: 2, fillColor: cssVar("--terracotta"), fillOpacity: 1, interactive: false });
    this.cursor = L.circleMarker([0, 0], { renderer: this.renderer, radius: 8, color: "#fff", weight: 3, fillColor: cssVar("--ochre"), fillOpacity: 1, interactive: false });
    this.cursor.bindTooltip("", { permanent: true, direction: "right", offset: [10, 0], className: "map__cursor-label" });

    this.drawTrack();
    this.renderControls();
    this.wireMap();
    this.disposer.add(
      session.on("cursor", (c) => { if (c.origin !== "map") this.hoverFromMap = false; this.showCursor(c.index, c.pinned); }),
      session.on("view", (v) => { this.highlight(v.zoomed ? v.range : null); if (!v.live) this.fit(v.range, true); }),
      session.on("preview", (p) => this.highlight(p.range ?? (session.isZoomed ? session.view : null))),
      session.on("section", (range) => this.showSection(range)),
      onThemeChange(ctx.prefs, () => { this.drawTrack(); this.highlight(session.preview ?? (session.isZoomed ? session.view : null)); }),
      ctx.prefs.on("changed", (key) => {
        if (key === "mapColour") { this.drawTrack(); this.renderControls(); }
        if (key === "follow") this.renderControls();
      }),
    );
    let fitted = false;
    const observer = new ResizeObserver(() => {
      if (this.canvas.clientWidth === 0) return;
      this.map.invalidateSize();
      if (!fitted) { fitted = true; this.fit(session.view, false); }
    });
    observer.observe(this.canvas);
    this.disposer.add(() => observer.disconnect());
  }

  dispose(): void {
    this.disposer.dispose();
    this.map.remove();
  }

  private firstFix(direction: 1 | -1): number {
    const n = this.lat.length;
    for (let k = 0; k < n; k++) {
      const i = direction === 1 ? k : n - 1 - k;
      if (!Number.isNaN(this.lat[i]!)) return i;
    }
    return 0;
  }

  /** Runs of consecutive samples with a position, as lat/lng lists (gaps break the line). */
  private runs(range: SampleRange): L.LatLngExpression[][] {
    const out: L.LatLngExpression[][] = [];
    let current: L.LatLngExpression[] = [];
    for (let i = range.from; i <= range.to; i++) {
      if (Number.isNaN(this.lat[i]!)) {
        if (current.length > 1) out.push(current);
        current = [];
      } else current.push([this.lat[i]!, this.lon[i]!]);
    }
    if (current.length > 1) out.push(current);
    return out;
  }

  private drawTrack(): void {
    this.trackLayer.clearLayers();
    const whole = this.session.whole;
    const all = this.runs(whole);
    L.polyline(all, { renderer: this.renderer, color: cssVar("--track-casing"), weight: 7, opacity: 0.9, interactive: false }).addTo(this.trackLayer);
    const colourBy = this.colourChannel();
    this.legend.hidden = colourBy === null;
    if (!colourBy) {
      L.polyline(all, { renderer: this.renderer, color: cssVar("--track"), weight: 4, interactive: false }).addTo(this.trackLayer);
      return;
    }
    const values = this.session.streams.channels[colourBy]!;
    const ramp = rampFor(values);
    const byBin: L.LatLngExpression[][][] = Array.from({ length: BINS }, () => []);
    let run: L.LatLngExpression[] = [];
    let runBin = -2;
    for (let i = 0; i < this.lat.length; i++) {
      const ok = !Number.isNaN(this.lat[i]!);
      const bin = ok ? binOf(ramp, values[i]!) : -1;
      if (!ok || bin !== runBin) {
        if (run.length > 1 && runBin >= 0) byBin[runBin]!.push(run);
        // the next run starts where this one ended, so the line has no gaps
        run = ok && run.length > 0 ? [run[run.length - 1]!] : [];
        runBin = bin;
      }
      if (ok) run.push([this.lat[i]!, this.lon[i]!]);
    }
    if (run.length > 1 && runBin >= 0) byBin[runBin]!.push(run);
    byBin.forEach((lines, b) => {
      if (lines.length) L.polyline(lines, { renderer: this.renderer, color: ramp.colours[b], weight: 4, interactive: false }).addTo(this.trackLayer);
    });
    const def = channelDef(colourBy);
    const { fmt } = this.ctx.i18n;
    const gradient = h("span", { class: "map__legend-bar" });
    gradient.style.backgroundImage = `linear-gradient(to right, ${ramp.colours[0]}, ${ramp.colours[Math.floor(BINS / 2)]}, ${ramp.colours[BINS - 1]})`;
    replaceChildren(this.legend, h("span", {}, fmt.channel(def, ramp.lo)), gradient, h("span", {}, fmt.channel(def, ramp.hi)));
  }

  private colourChannel(): ChannelKey | null {
    const choice = this.ctx.prefs.get("mapColour");
    return choice !== "plain" && this.session.streams.channels[choice] ? choice : null;
  }

  private renderControls(): void {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const { prefs } = this.ctx;
    const current = this.colourChannel() ?? "plain";
    const options: { value: "plain" | ChannelKey; label: string }[] = [
      { value: "plain", label: t("detail.colourPlain") },
      ...CHANNELS.filter((c) => c.colourable && this.session.streams.channels[c.key]).map((c) => ({ value: c.key, label: t(c.labelKey) })),
    ];
    const select = h("select", { class: "map__select", "aria-label": t("detail.colouring") },
      options.map((o) => h("option", { value: o.value, selected: o.value === current }, o.label)));
    select.addEventListener("change", () => prefs.set("mapColour", select.value as "plain" | ChannelKey));
    const follow = h("button", {
      type: "button", class: "map__follow", title: t("detail.follow"), "aria-pressed": String(prefs.get("follow")),
      onclick: () => prefs.set("follow", !prefs.get("follow")),
    }, icon("pin"));
    replaceChildren(this.controls, select, follow);
  }

  private wireMap(): void {
    let frame = 0;
    this.map.on("mousemove", (e: L.LeafletMouseEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const i = this.nearest(e.latlng, e.containerPoint);
        if (i !== null) { this.hoverFromMap = true; this.session.setHover(i, "map"); }
        else if (this.hoverFromMap) { this.hoverFromMap = false; this.session.setHover(null, "map"); }
      });
    });
    this.map.on("mouseout", () => {
      cancelAnimationFrame(frame);
      if (this.hoverFromMap) { this.hoverFromMap = false; this.session.setHover(null, "map"); }
    });
    this.map.on("click", (e: L.LeafletMouseEvent) => {
      const i = this.nearest(e.latlng, e.containerPoint);
      if (i === null) return;
      const pinned = this.session.cursor.pinned;
      if (e.originalEvent.shiftKey && pinned !== null) this.session.zoomTo({ from: pinned, to: i }, "map");
      else this.session.pin(i, "map");
    });
  }

  private nearest(latlng: L.LatLng, point: L.Point): number | null {
    const edge = this.map.containerPointToLatLng(point.add([0, HOVER_RADIUS_PX]));
    const radius = Math.abs(edge.lat - latlng.lat);
    return this.index.nearest(latlng.lat, latlng.lng, radius, this.session.cursor.index);
  }

  private showCursor(index: number | null, pinned: number | null): void {
    if (pinned !== null && pinned !== index && !Number.isNaN(this.lat[pinned]!)) this.pinMarker.setLatLng([this.lat[pinned]!, this.lon[pinned]!]).addTo(this.map);
    else this.pinMarker.remove();
    if (index === null || Number.isNaN(this.lat[index]!)) {
      this.cursor.remove();
      return;
    }
    const latlng = L.latLng(this.lat[index]!, this.lon[index]!);
    this.cursor.setLatLng(latlng).addTo(this.map);
    this.cursor.setStyle({ fillColor: index === pinned ? cssVar("--terracotta") : cssVar("--ochre") });
    const { fmt } = this.ctx.i18n;
    const { streams } = this.session;
    const colourBy = this.colourChannel();
    const extra = colourBy ? streams.channels[colourBy]![index] : Number.NaN;
    const text = [streams.distance ? fmt.distance(streams.distance[index]!) : fmt.duration(streams.time[index]!),
      colourBy && !Number.isNaN(extra!) ? fmt.channel(channelDef(colourBy), extra!) : null].filter(Boolean).join(" · ");
    this.cursor.setTooltipContent(text);
    if (this.ctx.prefs.get("follow")) {
      const size = this.map.getSize();
      const p = this.map.latLngToContainerPoint(latlng);
      if (p.x < size.x * 0.1 || p.x > size.x * 0.9 || p.y < size.y * 0.1 || p.y > size.y * 0.9) this.map.panTo(latlng, { animate: true, duration: 0.25 });
    }
  }

  /** The stretch in the track's highlight colour; the rest of the track fades. Null: no highlight. */
  private highlight(range: SampleRange | null): void {
    this.highlightLayer.clearLayers();
    this.canvas.classList.toggle("map__canvas--dimmed", range !== null);
    this.trackLayer.eachLayer((l) => (l as L.Polyline).setStyle({ opacity: range ? 0.35 : 1 }));
    if (!range) return;
    const runs = this.runs(range);
    L.polyline(runs, { renderer: this.renderer, color: cssVar("--track-casing"), weight: 9, interactive: false }).addTo(this.highlightLayer);
    L.polyline(runs, { renderer: this.renderer, color: cssVar("--track-highlight"), weight: 5, interactive: false }).addTo(this.highlightLayer);
  }

  private showSection(range: SampleRange | null): void {
    this.sectionLayer.clearLayers();
    if (!range) return;
    L.polyline(this.runs(range), { renderer: this.renderer, color: cssVar("--track-section"), weight: 8, opacity: 0.7, interactive: false }).addTo(this.sectionLayer);
  }

  private fit(range: SampleRange, animate: boolean): void {
    const points = this.runs(range).flat();
    if (points.length < 2) return;
    this.map.fitBounds(L.latLngBounds(points), { padding: [24, 24], animate, maxZoom: 17 });
  }
}
