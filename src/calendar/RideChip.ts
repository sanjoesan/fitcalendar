// One ride in a day cell: sport colour and icon, distance, time and climb; links to the detail page.

import type { AppContext } from "../app/context";
import { routeHref } from "../app/Router";
import { SPORTS } from "../model/sports";
import type { ActivitySummary } from "../model/types";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { rideTitle } from "../ui/rideTitle";

export function rideChip(ctx: AppContext, ride: ActivitySummary, compact: boolean): HTMLAnchorElement {
  const { fmt } = ctx.i18n;
  const sport = SPORTS[ride.sport];
  const chip = h("a", {
    class: `chip${ctx.recentlyAdded.has(ride.id) ? " chip--new" : ""}`,
    href: routeHref({ kind: "ride", id: ride.id, view: null }),
    "data-ride": ride.id,
    "data-sport": ride.sport,
    "aria-label": `${rideTitle(ctx.i18n, ride)}, ${fmt.distance(ride.distance)}, ${fmt.durationShort(ride.movingTime)}`,
  },
    h("span", { class: "chip__head" }, icon(sport.icon, "chip__icon"), h("strong", { class: "chip__distance" }, fmt.distance(ride.distance))),
    compact ? null : h("span", { class: "chip__meta" }, `${fmt.durationShort(ride.movingTime)} · ↑${fmt.ascent(ride.ascent)}`),
    compact ? null : h("span", { class: "chip__title" }, rideTitle(ctx.i18n, ride)),
  );
  chip.style.setProperty("--sport", `var(${sport.colour})`);
  return chip;
}
