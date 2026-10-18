// The card that appears when the pointer rests on a ride chip: name, date, a track and elevation sketch, key numbers.
// Built from the summary alone - no streams are loaded.

import type { AppContext } from "../app/context";
import type { ActivitySummary } from "../model/types";
import { h, replaceChildren } from "../ui/dom";
import { rideTitle } from "../ui/rideTitle";

const SHOW_DELAY_MS = 350;
const SVG_NS = "http://www.w3.org/2000/svg";

export class RidePreview {
  readonly element = h("div", { class: "preview", role: "tooltip", hidden: true });
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly ctx: AppContext) {}

  /** Wires hover and focus of every chip inside `container`. */
  attach(container: HTMLElement): void {
    container.addEventListener("pointerover", (e) => this.schedule(e.target));
    container.addEventListener("focusin", (e) => this.schedule(e.target));
    container.addEventListener("pointerout", (e) => { if (!(e.relatedTarget instanceof Node && this.chipOf(e.relatedTarget))) this.hide(); });
    container.addEventListener("focusout", () => this.hide());
  }

  hide(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.element.hidden = true;
  }

  private chipOf(target: EventTarget | null): HTMLElement | null {
    return target instanceof Element ? target.closest<HTMLElement>("[data-ride]") : null;
  }

  private schedule(target: EventTarget | null): void {
    const chip = this.chipOf(target);
    if (!chip) return;
    const ride = this.ctx.rides.get(chip.dataset.ride!);
    if (!ride) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.show(chip, ride), SHOW_DELAY_MS);
  }

  private show(chip: HTMLElement, ride: ActivitySummary): void {
    const { fmt } = this.ctx.i18n;
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const hr = ride.channels.heartRate;
    const power = ride.power?.normalized ?? ride.channels.power?.mean;
    replaceChildren(this.element,
      h("strong", { class: "preview__title" }, rideTitle(this.ctx.i18n, ride)),
      h("span", { class: "preview__date" }, `${fmt.rideDateLong(ride.start, ride.tzOffsetMin)} · ${fmt.rideTime(ride.start, ride.tzOffsetMin)}`),
      ride.preview.track.length > 1 ? trackSketch(ride.preview.track) : null,
      ride.preview.elevation.length > 1 ? elevationSketch(ride.preview.elevation) : null,
      h("dl", { class: "preview__stats" },
        stat(t("totals.distance"), fmt.distance(ride.distance)),
        stat(t("totals.movingTime"), fmt.duration(ride.movingTime)),
        stat(t("totals.ascent"), fmt.ascent(ride.ascent)),
        hr ? stat(t("stat.heartRate"), `${fmt.number(hr.mean)} ${t("unit.bpm")}`) : null,
        power !== undefined ? stat(ride.power?.normalized ? "NP" : t("stat.power"), `${fmt.number(power)} ${t("unit.w")}`) : null,
      ),
    );
    this.element.hidden = false;
    const r = chip.getBoundingClientRect();
    const width = this.element.offsetWidth;
    const height = this.element.offsetHeight;
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    const below = r.bottom + 8 + height < window.innerHeight;
    this.element.style.left = `${left + window.scrollX}px`;
    this.element.style.top = `${(below ? r.bottom + 8 : r.top - height - 8) + window.scrollY}px`;
  }
}

function stat(label: string, value: string): HTMLElement[] {
  return [h("dt", {}, label), h("dd", {}, value)];
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** The track in an equirectangular projection scaled into the box (latitude-corrected). */
function trackSketch(track: readonly (readonly [number, number])[]): SVGSVGElement {
  const W = 240;
  const H = 110;
  const lats = track.map((p) => p[0]);
  const lons = track.map((p) => p[1]);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const xs = lons.map((l) => l * kx);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...lats), Math.max(...lats)];
  const scale = Math.min((W - 12) / (x1 - x0 || 1), (H - 12) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * scale) / 2;
  const oy = (H - (y1 - y0) * scale) / 2;
  const d = track.map((p, i) => `${i ? "L" : "M"}${(ox + (xs[i]! - x0) * scale).toFixed(1)},${(H - oy - (p[0] - y0) * scale).toFixed(1)}`).join("");
  const svg = svgElement("svg", { class: "preview__track", viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" });
  svg.append(svgElement("path", { d, class: "preview__track-line" }));
  return svg;
}

function elevationSketch(elevation: readonly number[]): SVGSVGElement {
  const W = 240;
  const H = 36;
  const lo = Math.min(...elevation);
  const hi = Math.max(...elevation);
  const y = (v: number) => H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
  const step = W / (elevation.length - 1);
  const line = elevation.map((v, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const svg = svgElement("svg", { class: "preview__elevation", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" });
  svg.append(svgElement("path", { d: `${line}L${W},${H}L0,${H}Z`, class: "preview__elevation-area" }), svgElement("path", { d: line, class: "preview__elevation-line" }));
  return svg;
}
