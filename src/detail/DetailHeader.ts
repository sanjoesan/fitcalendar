// The detail page's head: back to the month, the ride's name (click to rename), date and sport, previous/next ride,
// and the menu with download and delete.

import type { AppContext } from "../app/context";
import { routeHref } from "../app/Router";
import { monthOf } from "../model/calendar";
import { SPORTS } from "../model/sports";
import type { ActivitySummary } from "../model/types";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { rideTitle } from "../ui/rideTitle";

export interface HeaderActions {
  readonly rename: (title: string | null) => void;
  readonly download: () => void;
  readonly remove: () => void;
}

export function backLink(ctx: AppContext, ride: ActivitySummary): HTMLElement {
  const month = monthOf(ride.day);
  return h("a", { class: "back-link", href: routeHref({ kind: "month", month }) },
    icon("chevronLeft"), ctx.i18n.fmt.monthYear(month.year, month.month));
}

export function detailHeader(ctx: AppContext, ride: ActivitySummary, actions: HeaderActions): HTMLElement {
  const { fmt } = ctx.i18n;
  const t = ctx.i18n.t.bind(ctx.i18n);
  const sport = SPORTS[ride.sport];
  const prev = ctx.rides.neighbour(ride.id, -1);
  const next = ctx.rides.neighbour(ride.id, 1);
  const titleSlot = h("div", { class: "detail-head__title" });

  const showTitle = () => replaceChildren(titleSlot,
    h("h1", {}, rideTitle(ctx.i18n, ride)),
    h("button", { class: "icon-button icon-button--small", type: "button", title: t("action.rename"), onclick: edit }, icon("edit")));
  const edit = () => {
    const input = h("input", { class: "input detail-head__input", value: ride.title ?? "", "aria-label": t("action.rename"), maxlength: 120 });
    const done = (save: boolean) => {
      if (save) actions.rename(input.value.trim() || null);
      else showTitle();
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(true);
      if (e.key === "Escape") { e.stopPropagation(); done(false); }
    });
    input.addEventListener("blur", () => done(true));
    replaceChildren(titleSlot, input);
    input.focus();
    input.select();
  };
  showTitle();

  const menu = h("div", { class: "menu", hidden: true, role: "menu" },
    h("button", { class: "menu__item", type: "button", role: "menuitem", onclick: () => { menu.hidden = true; actions.download(); } }, icon("download"), t("action.download")),
    h("button", { class: "menu__item menu__item--danger", type: "button", role: "menuitem", onclick: () => { menu.hidden = true; actions.remove(); } }, icon("trash"), t("action.delete")));
  const menuButton = h("button", { class: "icon-button", type: "button", title: t("action.more"), "aria-haspopup": "menu",
    onclick: () => { menu.hidden = !menu.hidden; } }, icon("more"));
  const anchor = h("div", { class: "menu-anchor" }, menuButton, menu);
  anchor.addEventListener("focusout", (e) => {
    if (!(e.relatedTarget instanceof Node && anchor.contains(e.relatedTarget))) menu.hidden = true;
  });
  anchor.addEventListener("keydown", (e) => { if (e.key === "Escape") { menu.hidden = true; e.stopPropagation(); } });

  const subtitle = [
    fmt.rideDateLong(ride.start, ride.tzOffsetMin),
    fmt.rideTime(ride.start, ride.tzOffsetMin),
    t(sport.labelKey),
    ride.indoor ? t("sport.indoor") : null,
    ride.deviceName ? t("detail.device", { device: ride.deviceName }) : null,
  ].filter(Boolean).join(" · ");

  const neighbour = (target: ActivitySummary | undefined, key: "action.prevRide" | "action.nextRide", name: "chevronLeft" | "chevronRight", hint: string) =>
    target
      ? h("a", { class: "icon-button", href: routeHref({ kind: "ride", id: target.id, view: null }), title: `${t(key)}: ${rideTitle(ctx.i18n, target)} (${hint})`, "aria-label": t(key) }, icon(name))
      : h("span", { class: "icon-button icon-button--disabled", "aria-hidden": "true" }, icon(name));

  const head = h("header", { class: "detail-head" },
    h("div", { class: "detail-head__main" },
      h("span", { class: "detail-head__sport", "aria-hidden": "true" }, icon(sport.icon)),
      h("div", { class: "detail-head__text" }, titleSlot, h("p", { class: "detail-head__sub" }, subtitle))),
    h("div", { class: "detail-head__actions" },
      neighbour(prev, "action.prevRide", "chevronLeft", "PgUp"),
      neighbour(next, "action.nextRide", "chevronRight", "PgDn"),
      anchor));
  head.style.setProperty("--sport", `var(${sport.colour})`);
  return head;
}
