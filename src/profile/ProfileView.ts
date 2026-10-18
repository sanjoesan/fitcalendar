// The athlete profile: FTP, heart rates and weight with the day they apply from, suggestions from the rides,
// and the zone boundaries. Every ride uses the values that applied on its day.

import type { AppContext, View } from "../app/context";
import { Disposer } from "../app/Emitter";
import { ATHLETE_FIELDS, profileValuesAt, type AthleteEntry, type AthleteField } from "../model/athlete";
import { today } from "../model/calendar";
import type { AthleteValues } from "../model/types";
import { ZONE_SCHEMES, type ZoneScheme } from "../model/zones";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { rideTitle } from "../ui/rideTitle";
import { languageSwitch, themeSwitch } from "../ui/settingsControls";
import type { TextKey } from "../i18n/de";

interface FieldDef {
  readonly field: AthleteField;
  readonly labelKey: TextKey;
  readonly unitKey: TextKey;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

const FIELDS: readonly FieldDef[] = [
  { field: "ftp", labelKey: "profile.ftp", unitKey: "unit.w", min: 50, max: 600, step: 1 },
  { field: "maxHr", labelKey: "profile.maxHr", unitKey: "unit.bpm", min: 100, max: 230, step: 1 },
  { field: "lthr", labelKey: "profile.lthr", unitKey: "unit.bpm", min: 80, max: 220, step: 1 },
  { field: "restHr", labelKey: "profile.restHr", unitKey: "unit.bpm", min: 25, max: 120, step: 1 },
  { field: "weight", labelKey: "profile.weight", unitKey: "unit.kg", min: 30, max: 200, step: 0.1 },
];

/** FTP estimate from the best 20 minutes (the common 95 % rule). */
const FTP_FROM_20MIN = 0.95;

export class ProfileView implements View {
  readonly element = h("div", { class: "profile" });
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext) {
    this.disposer.add(ctx.athlete.on("changed", () => this.render()), ctx.rides.on("changed", () => this.render()));
    this.render();
  }

  dispose(): void {
    this.disposer.dispose();
  }

  private render(): void {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    replaceChildren(this.element,
      h("header", { class: "profile__head" }, h("h1", {}, t("profile.title")), h("p", { class: "profile__intro" }, t("profile.intro"))),
      h("div", { class: "profile__grid" }, this.currentCard(), this.suggestionsCard()),
      this.historyCard(),
      h("div", { class: "profile__grid" }, ZONE_SCHEMES.map((s) => this.zonesCard(s))),
      h("section", { class: "card" }, h("h2", {}, t("theme.label")),
        h("div", { class: "settings-row" },
          h("label", {}, t("lang.label"), languageSwitch(this.ctx)),
          h("label", {}, t("theme.label"), themeSwitch(this.ctx, () => this.render())))),
    );
  }

  /** Today's values and the form for a new entry. */
  private currentCard(): HTMLElement {
    const { ctx } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const current = profileValuesAt(ctx.athlete.profile, today());
    const date = h("input", { class: "input", type: "date", value: today(), required: true, "aria-label": t("profile.validFrom") });
    const inputs = new Map<AthleteField, HTMLInputElement>();
    const form = h("form", { class: "card profile-form" },
      h("h2", {}, t("profile.current")),
      h("div", { class: "profile-form__fields" }, FIELDS.map((f) => {
        const input = h("input", { class: "input", type: "number", min: f.min, max: f.max, step: f.step, placeholder: current[f.field] !== undefined ? String(current[f.field]) : "–" });
        inputs.set(f.field, input);
        return h("label", { class: "field" },
          h("span", { class: "field__label" }, t(f.labelKey)),
          h("span", { class: "field__control" }, input, h("span", { class: "field__unit" }, t(f.unitKey))),
          h("span", { class: "field__current" }, current[f.field] !== undefined ? t("profile.now", { v: ctx.i18n.fmt.number(current[f.field]!, f.step < 1 ? 1 : 0) }) : t("profile.notSet")));
      })),
      h("div", { class: "profile-form__foot" },
        h("label", { class: "field field--inline" }, h("span", { class: "field__label" }, t("profile.validFrom")), date),
        h("button", { class: "button button--primary", type: "submit" }, icon("plus"), t("profile.saveEntry"))),
      h("p", { class: "profile-form__hint" }, t("profile.entryHint")));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const values: Partial<Record<AthleteField, number>> = {};
      for (const [field, input] of inputs) if (input.value !== "" && Number(input.value) > 0) values[field] = Number(input.value);
      if (Object.keys(values).length === 0) return;
      void ctx.athlete.setEntry({ id: crypto.randomUUID(), validFrom: date.value || today(), ...values });
    });
    return form;
  }

  /** Values derived from the stored rides, to take over with one click. */
  private suggestionsCard(): HTMLElement {
    const { ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const rides = ctx.rides.all();
    const best20 = rides.reduce<{ watts: number; ride: (typeof rides)[number] } | null>((best, r) => {
      const w = r.power?.bestEfforts.find((e) => e.duration === 1200)?.watts;
      return w !== undefined && (!best || w > best.watts) ? { watts: w, ride: r } : best;
    }, null);
    const maxHr = rides.reduce<{ bpm: number; ride: (typeof rides)[number] } | null>((best, r) => {
      const v = r.channels.heartRate?.max;
      return v !== undefined && (!best || v > best.bpm) ? { bpm: v, ride: r } : best;
    }, null);
    const fromFile = [...rides].reverse().find((r) => ATHLETE_FIELDS.some((f) => r.fileAthlete[f] !== undefined));
    const take = (values: AthleteValues) => void ctx.athlete.setEntry({ id: crypto.randomUUID(), validFrom: today(), ...values });
    const items: HTMLElement[] = [];
    if (best20) {
      const ftp = Math.round(best20.watts * FTP_FROM_20MIN);
      items.push(suggestion(t("profile.suggestFtp", { v: fmt.number(ftp), w: fmt.number(best20.watts) }),
        `${rideTitle(ctx.i18n, best20.ride)} · ${fmt.rideDateShort(best20.ride.start, best20.ride.tzOffsetMin)}`, t("profile.take"), () => take({ ftp })));
    }
    if (maxHr) {
      items.push(suggestion(t("profile.suggestMaxHr", { v: fmt.number(maxHr.bpm) }),
        `${rideTitle(ctx.i18n, maxHr.ride)} · ${fmt.rideDateShort(maxHr.ride.start, maxHr.ride.tzOffsetMin)}`, t("profile.take"), () => take({ maxHr: Math.round(maxHr.bpm) })));
    }
    if (fromFile) {
      const values = Object.fromEntries(ATHLETE_FIELDS.flatMap((f) => (fromFile.fileAthlete[f] !== undefined ? [[f, fromFile.fileAthlete[f]]] : []))) as AthleteValues;
      const text = FIELDS.filter((f) => values[f.field] !== undefined).map((f) => `${t(f.labelKey)} ${fmt.number(values[f.field]!)}`).join(" · ");
      items.push(suggestion(t("profile.suggestFile", { v: text }), `${rideTitle(ctx.i18n, fromFile)} · ${fmt.rideDateShort(fromFile.start, fromFile.tzOffsetMin)}`, t("profile.take"), () => take(values)));
    }
    return h("section", { class: "card" },
      h("h2", {}, t("profile.suggestions")),
      items.length ? h("ul", { class: "suggestions" }, items) : h("p", { class: "muted" }, t("profile.noSuggestions")));
  }

  private historyCard(): HTMLElement {
    const { ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const entries = [...ctx.athlete.profile.entries].reverse();
    return h("section", { class: "card" },
      h("h2", {}, t("profile.history")),
      entries.length === 0
        ? h("p", { class: "muted" }, t("profile.noHistory"))
        : h("div", { class: "table-scroll" }, h("table", { class: "table" },
            h("thead", {}, h("tr", {}, h("th", {}, t("profile.validFrom")), FIELDS.map((f) => h("th", {}, `${t(f.labelKey)} (${t(f.unitKey)})`)), h("th", {}, ""))),
            h("tbody", {}, entries.map((e: AthleteEntry) => h("tr", {},
              h("td", {}, fmt.dayLong(e.validFrom)),
              FIELDS.map((f) => h("td", {}, e[f.field] !== undefined ? fmt.number(e[f.field]!, f.step < 1 ? 1 : 0) : "")),
              h("td", {}, h("button", { class: "icon-button icon-button--small", type: "button", title: t("profile.removeEntry"),
                onclick: () => void ctx.athlete.removeEntry(e.id) }, icon("trash")))))))));
  }

  /** The zone boundaries in % of the reference, editable, with today's absolute values. */
  private zonesCard(scheme: ZoneScheme): HTMLElement {
    const { ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const custom = ctx.athlete.profile.zoneFractions[scheme.channel];
    const fractions = custom ?? scheme.zones.map((z) => z.from);
    const reference = profileValuesAt(ctx.athlete.profile, today())[scheme.reference];
    const unit = t(scheme.reference === "ftp" ? "unit.w" : "unit.bpm");
    const inputs = fractions.map((f, i) => h("input", {
      class: "input input--narrow", type: "number", min: 0, max: 300, step: 1, value: Math.round(f * 100), disabled: i === 0,
      "aria-label": `Z${i + 1} ${t("profile.zoneFrom")}`,
    }));
    const form = h("form", { class: "card zone-editor" },
      h("h2", {}, t(scheme.titleKey)),
      h("p", { class: "muted" }, t(scheme.reference === "ftp" ? "profile.zonesOfFtp" : "profile.zonesOfMaxHr")),
      h("table", { class: "table" },
        h("thead", {}, h("tr", {}, h("th", {}, ""), h("th", {}, t("profile.zoneFrom")), h("th", {}, reference ? `${t("profile.today")} (${unit})` : ""))),
        h("tbody", {}, scheme.zones.map((z, i) => {
          const swatch = h("span", { class: "zone-swatch" });
          swatch.style.backgroundColor = `var(${z.colour})`;
          const lower = reference ? fractions[i]! * reference : null;
          const upper = reference && fractions[i + 1] !== undefined ? fractions[i + 1]! * reference - 1 : null;
          return h("tr", {},
            h("td", {}, swatch, h("strong", {}, ` Z${i + 1} `), t(z.nameKey)),
            h("td", {}, inputs[i]!, " %"),
            h("td", {}, lower === null ? "" : upper === null ? `> ${fmt.number(lower)}` : `${fmt.number(lower)}–${fmt.number(upper)}`));
        }))),
      h("div", { class: "zone-editor__actions" },
        custom ? h("button", { class: "button button--quiet", type: "button", onclick: () => void ctx.athlete.clearZoneFractions(scheme.channel) }, t("profile.zonesDefault")) : null,
        h("button", { class: "button button--primary", type: "submit" }, t("action.save"))));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const next = inputs.map((input, i) => (i === 0 ? 0 : Number(input.value) / 100));
      const ascending = next.every((v, i) => i === 0 || v > next[i - 1]!);
      if (!ascending) {
        ctx.toasts.show(t("profile.zonesOrder"));
        return;
      }
      void ctx.athlete.setZoneFractions(scheme.channel, next);
    });
    return form;
  }
}

function suggestion(text: string, source: string, action: string, run: () => void): HTMLElement {
  return h("li", { class: "suggestion" },
    h("div", {}, h("strong", {}, text), h("span", { class: "suggestion__source" }, source)),
    h("button", { class: "button", type: "button", onclick: run }, action));
}
