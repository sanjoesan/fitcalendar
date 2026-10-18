// Time in heart-rate and power zones for the view (or the stretch being dragged). Without FTP / max heart rate
// the card asks for the value right there and stores it in the profile.

import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import { athleteForRide, zonesForRide, type ResolvedZones } from "../model/athlete";
import { today } from "../model/calendar";
import { movingWeights } from "../model/segment";
import { timeInZones, ZONE_SCHEMES, type ZoneScheme } from "../model/zones";
import { h, replaceChildren } from "../ui/dom";
import type { DetailSession } from "./DetailSession";

export class ZonesPanel {
  readonly element = h("section", { class: "zones" });
  private frame = 0;
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    const schedule = () => {
      cancelAnimationFrame(this.frame);
      this.frame = requestAnimationFrame(() => this.render());
    };
    this.disposer.add(session.on("view", schedule), session.on("preview", schedule), ctx.athlete.on("changed", () => this.render()));
    this.render();
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.disposer.dispose();
  }

  private render(): void {
    const { session, ctx } = this;
    const schemes = ZONE_SCHEMES.filter((s) => session.streams.channels[s.channel]);
    this.element.hidden = schemes.length === 0;
    const athlete = athleteForRide(ctx.athlete.profile, session.summary);
    replaceChildren(this.element, schemes.map((scheme) => {
      const zones = zonesForRide(scheme, ctx.athlete.profile, athlete);
      return zones ? this.card(zones) : this.ask(scheme);
    }));
  }

  private card(zones: ResolvedZones): HTMLElement {
    const { session, ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const range = session.preview ?? session.view;
    const values = session.streams.channels[zones.scheme.channel]!;
    const seconds = timeInZones(zones.lowerBounds, values, movingWeights(session.streams, range), range.from, range.to);
    const total = seconds.reduce((a, b) => a + b, 0) || 1;
    const unit = t(zones.scheme.reference === "ftp" ? "unit.w" : "unit.bpm");
    const refLabel = t(zones.scheme.reference === "ftp" ? "zones.ftpIs" : "zones.maxHrIs", { v: fmt.number(zones.reference) });
    return h("article", { class: "zone-card" },
      h("header", { class: "zone-card__head" },
        h("h3", {}, t(zones.scheme.titleKey)),
        h("span", { class: "zone-card__ref" }, refLabel)),
      h("ol", { class: "zone-list" }, [...zones.scheme.zones].map((zone, i) => i).reverse().map((i) => {
        const zone = zones.scheme.zones[i]!;
        const lower = zones.lowerBounds[i]!;
        const upper = zones.lowerBounds[i + 1];
        const bounds = i === 0 ? `< ${fmt.number(upper!)}` : upper === undefined ? `> ${fmt.number(lower)}` : `${fmt.number(lower)}–${fmt.number(upper - 1)}`;
        const share = seconds[i]! / total;
        const bar = h("span", { class: "zone-row__bar" });
        bar.style.inlineSize = `${share * 100}%`;
        bar.style.backgroundColor = `var(${zone.colour})`;
        return h("li", { class: "zone-row" },
          h("span", { class: "zone-row__name" }, h("strong", {}, `Z${i + 1}`), ` ${t(zone.nameKey)}`),
          h("span", { class: "zone-row__bounds" }, `${bounds} ${unit}`),
          h("span", { class: "zone-row__track" }, bar),
          h("span", { class: "zone-row__time" }, fmt.duration(seconds[i]!)),
          h("span", { class: "zone-row__pct" }, `${fmt.number(share * 100)} %`));
      })));
  }

  /** No reference value anywhere: a small form right in the card. */
  private ask(scheme: ZoneScheme): HTMLElement {
    const { ctx } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const field = scheme.reference;
    const input = h("input", { type: "number", min: field === "ftp" ? 50 : 100, max: field === "ftp" ? 600 : 230, step: 1, class: "input", required: true,
      "aria-label": t(field === "ftp" ? "profile.ftp" : "profile.maxHr") });
    const form = h("form", { class: "zone-card zone-card--ask" },
      h("h3", {}, t(scheme.titleKey)),
      h("p", {}, t(field === "ftp" ? "zones.askFtp" : "zones.askMaxHr")),
      h("div", { class: "inline-form" }, input,
        h("span", { class: "inline-form__unit" }, t(field === "ftp" ? "unit.w" : "unit.bpm")),
        h("button", { class: "button button--primary", type: "submit" }, t("action.save"))),
      h("a", { class: "zone-card__link", href: "#/profile" }, t("zones.toProfile")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = Number(input.value);
      if (!(value > 0)) return;
      void ctx.athlete.setEntry({ id: crypto.randomUUID(), validFrom: today(), [field]: value });
    });
    return form;
  }
}
