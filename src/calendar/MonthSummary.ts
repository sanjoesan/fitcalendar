// The band under the grid: the month's totals with the change against the month before and the longest ride.
// Without rides in the month: where the nearest rides are.

import type { AppContext } from "../app/context";
import { routeHref } from "../app/Router";
import { monthOf, type YearMonth } from "../model/calendar";
import type { Totals } from "../model/totals";
import type { ActivitySummary } from "../model/types";
import { h } from "../ui/dom";
import { rideTitle } from "../ui/rideTitle";
import type { MonthModel } from "./MonthModel";
import { TOTALS_METRIC_DEFS } from "./totalsMetrics";

export interface MonthSummaryInput {
  readonly model: MonthModel;
  readonly previous: Totals;
  readonly before: ActivitySummary | undefined;
  readonly after: ActivitySummary | undefined;
}

export function monthSummary(ctx: AppContext, { model, previous, before, after }: MonthSummaryInput): HTMLElement {
  const { fmt } = ctx.i18n;
  const t = ctx.i18n.t.bind(ctx.i18n);
  const { totals } = model;
  const monthLink = (ride: ActivitySummary, key: "calendar.lastRide" | "calendar.nextRide") =>
    h("a", { href: routeHref({ kind: "month", month: monthOf(ride.day) as YearMonth }) }, t(key, { date: fmt.rideDateShort(ride.start, ride.tzOffsetMin) }));

  if (totals.count === 0) {
    return h("section", { class: "month-summary month-summary--empty" },
      h("p", {}, t("calendar.noRidesMonth", { month: fmt.monthName(model.month.year, model.month.month) })),
      h("p", { class: "month-summary__nav" }, before ? monthLink(before, "calendar.lastRide") : null, after ? monthLink(after, "calendar.nextRide") : null));
  }

  const figures = TOTALS_METRIC_DEFS.filter((d) => d.key !== "stress" || totals.stress > 0).map((d) => {
    const now = d.value(totals);
    const before_ = d.value(previous);
    return h("div", { class: "figure" },
      h("span", { class: "figure__label" }, t(d.labelKey)),
      h("strong", { class: "figure__value" }, d.format(fmt, now)),
      before_ > 0 ? h("span", { class: now >= before_ ? "figure__change figure__change--up" : "figure__change" }, `${fmt.change(now / before_ - 1)} ${t("calendar.vsPrev")}`) : null);
  });
  return h("section", { class: "month-summary", "aria-label": t("calendar.monthTotal") },
    h("h2", { class: "month-summary__title" }, t("calendar.monthTotal")),
    h("div", { class: "month-summary__figures" },
      h("div", { class: "figure" }, h("span", { class: "figure__label" }, t("totals.count")), h("strong", { class: "figure__value" }, totals.count)),
      figures,
      h("div", { class: "figure" }, h("span", { class: "figure__label" }, t("calendar.perRide")),
        h("strong", { class: "figure__value" }, fmt.distance(totals.distance / totals.count))),
      model.longest ? h("div", { class: "figure" }, h("span", { class: "figure__label" }, t("calendar.longest")),
        h("a", { class: "figure__link", href: routeHref({ kind: "ride", id: model.longest.id, view: null }) },
          `${rideTitle(ctx.i18n, model.longest)} · ${fmt.distance(model.longest.distance)}`)) : null),
  );
}
