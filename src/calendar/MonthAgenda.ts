// The month on a phone: one card per week with its totals, a strip of day dots and the rides as rows.

import type { AppContext } from "../app/context";
import { routeHref } from "../app/Router";
import { addDays } from "../model/calendar";
import { SPORTS } from "../model/sports";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { rideTitle } from "../ui/rideTitle";
import type { MonthModel, WeekModel } from "./MonthModel";

export function monthAgenda(ctx: AppContext, model: MonthModel): HTMLElement {
  return h("div", { class: "agenda" }, model.weeks.map((w) => weekCard(ctx, w)));
}

function weekCard(ctx: AppContext, week: WeekModel): HTMLElement {
  const { fmt } = ctx.i18n;
  const t = ctx.i18n.t.bind(ctx.i18n);
  const rides = week.days.flatMap((d) => d.rides);
  const head = h("header", { class: "agenda-week__head" },
    h("span", { class: "agenda-week__title" },
      h("strong", {}, t("calendar.weekShort", { n: week.isoWeek })), ` · ${fmt.dayMonth(week.monday)} – ${fmt.dayMonth(addDays(week.monday, 6))}`),
    rides.length > 0
      ? h("span", { class: "agenda-week__totals" }, `${fmt.distance(week.totals.distance)} · ${fmt.durationShort(week.totals.movingTime)} · ↑${fmt.ascent(week.totals.ascent)}`)
      : null);
  if (rides.length === 0) return h("section", { class: "agenda-week agenda-week--empty" }, head, h("p", { class: "agenda-week__none" }, t("calendar.noRidesWeek")));
  const maxDay = Math.max(1, ...week.days.map((d) => d.rides.reduce((s, r) => s + r.distance, 0)));
  const dots = h("div", { class: "agenda-week__dots", role: "list" }, week.days.map((d, i) => {
    const km = d.rides.reduce((s, r) => s + r.distance, 0);
    const dot = h("button", {
      type: "button", role: "listitem",
      class: `agenda-dot${d.isToday ? " agenda-dot--today" : ""}${d.inMonth ? "" : " agenda-dot--out"}`,
      "aria-label": fmt.dayLong(d.key), disabled: d.rides.length === 0,
      onclick: () => document.getElementById(`agenda-${d.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    }, h("span", { class: "agenda-dot__day" }, t(`weekday.short.${i}` as "weekday.short.0")), h("span", { class: "agenda-dot__mark" }));
    dot.style.setProperty("--size", String(km > 0 ? 0.45 + 0.55 * (km / maxDay) : 0));
    return dot;
  }));
  const list = h("ul", { class: "agenda-week__rides" }, week.days.flatMap((d) => d.rides.map((r, i) => {
    const row = h("li", { id: i === 0 ? `agenda-${d.key}` : undefined },
      h("a", { class: `agenda-ride${ctx.recentlyAdded.has(r.id) ? " chip--new" : ""}`, href: routeHref({ kind: "ride", id: r.id, view: null }), "data-ride": r.id },
        icon(SPORTS[r.sport].icon, "agenda-ride__icon"),
        h("span", { class: "agenda-ride__when" }, fmt.dayLong(d.key)),
        h("span", { class: "agenda-ride__title" }, rideTitle(ctx.i18n, r)),
        h("span", { class: "agenda-ride__numbers" }, `${fmt.distance(r.distance)} · ${fmt.durationShort(r.movingTime)} · ↑${fmt.ascent(r.ascent)}`)));
    (row.firstElementChild as HTMLElement).style.setProperty("--sport", `var(${SPORTS[r.sport].colour})`);
    return row;
  })));
  return h("section", { class: "agenda-week" }, head, dots, list);
}
