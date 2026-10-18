// The calendar screen: month navigation in the top bar, the month as grid (or agenda on phones), its totals,
// and the empty state. Re-renders when rides, the profile or the bar choice change.

import { isTyping } from "../app/App";
import type { AppContext, View } from "../app/context";
import { Disposer } from "../app/Emitter";
import { addDays, addMonths, compareMonths, monthKey, monthOf, today, weeksOfMonth, type YearMonth } from "../model/calendar";
import { athleteForRide } from "../model/athlete";
import { rideLoad } from "../model/load";
import { aggregate } from "../model/totals";
import type { ActivitySummary } from "../model/types";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { monthAgenda } from "./MonthAgenda";
import { monthGrid } from "./MonthGrid";
import { buildMonth, type StressOf } from "./MonthModel";
import { MonthPicker } from "./MonthPicker";
import { monthSummary } from "./MonthSummary";
import { RidePreview } from "./RidePreview";

const PHONE = "(max-width: 699px)";
const TABLET = "(max-width: 1099px)";
const SWIPE_PX = 60;

export class CalendarView implements View {
  readonly element = h("div", { class: "calendar" });
  readonly toolbar: HTMLElement;
  private readonly body = h("div", { class: "calendar__body" });
  private readonly preview: RidePreview;
  private readonly picker: MonthPicker;
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly month: YearMonth, private readonly openImport: () => void) {
    const t = ctx.i18n.t.bind(ctx.i18n);
    this.preview = new RidePreview(ctx);
    this.picker = new MonthPicker(ctx, month);
    const title = h("button", { class: "month-nav__title", type: "button", "aria-haspopup": "dialog", title: t("calendar.pickMonth") },
      ctx.i18n.fmt.monthYear(month.year, month.month));
    title.addEventListener("click", () => this.picker.toggle(title));
    this.toolbar = h("div", { class: "month-nav" },
      h("a", { class: "icon-button", href: `#/${monthKey(addMonths(month, -1))}`, title: `${t("action.prevMonth")} (PgUp)`, "aria-label": t("action.prevMonth") }, icon("chevronLeft")),
      title,
      h("a", { class: "icon-button", href: `#/${monthKey(addMonths(month, 1))}`, title: `${t("action.nextMonth")} (PgDn)`, "aria-label": t("action.nextMonth") }, icon("chevronRight")),
      h("a", { class: "button button--quiet", href: `#/${monthKey(monthOf(today()))}`, title: `${t("action.today")} (T)` }, t("action.today")),
    );
    this.element.append(this.body, this.preview.element, this.picker.element);
    this.preview.attach(this.body);

    const rerender = () => this.render();
    const phone = matchMedia(PHONE);
    const tablet = matchMedia(TABLET);
    phone.addEventListener("change", rerender);
    tablet.addEventListener("change", rerender);
    this.disposer.add(
      () => phone.removeEventListener("change", rerender),
      () => tablet.removeEventListener("change", rerender),
      ctx.rides.on("changed", rerender),
      ctx.athlete.on("changed", rerender),
      ctx.prefs.on("changed", (key) => { if (key === "barMetric") rerender(); }),
    );
    this.disposer.listen(document, "keydown", (e) => this.onKey(e));
    this.wireSwipe();
    this.render();
  }

  dispose(): void {
    this.disposer.dispose();
    this.preview.hide();
  }

  private render(): void {
    const { ctx, month } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const mondays = weeksOfMonth(month);
    const ridesByDay = ctx.rides.byDay(mondays[0]!, addDays(mondays.at(-1)!, 6));
    const stressOf: StressOf = (r) => rideLoad(r, athleteForRide(ctx.athlete.profile, r))?.stress ?? null;
    const model = buildMonth(month, ridesByDay, stressOf);
    const prevMonth = addMonths(month, -1);
    const previous = aggregate(ctx.rides.all().filter((r) => sameMonth(r, prevMonth)), stressOf);
    const all = ctx.rides.all();
    const metric = ctx.prefs.get("barMetric");
    const phone = matchMedia(PHONE).matches;
    const compact = matchMedia(TABLET).matches;
    this.preview.hide();

    const grid = phone ? monthAgenda(ctx, model) : monthGrid(ctx, model, metric, compact);
    const summary = monthSummary(ctx, {
      model, previous, metric,
      onMetric: (m) => ctx.prefs.set("barMetric", m),
      before: [...all].reverse().find((r) => compareMonths(monthOf(r.day), month) < 0),
      after: all.find((r) => compareMonths(monthOf(r.day), month) > 0),
    });
    const empty = all.length === 0
      ? h("div", { class: "empty-state" },
          h("div", { class: "empty-state__card" },
            icon("logo", "empty-state__art"),
            h("h2", {}, t("calendar.emptyTitle")),
            h("p", {}, t("calendar.emptyText")),
            h("button", { class: "button button--primary", type: "button", onclick: () => this.openImport() }, icon("upload"), t("action.import")),
            h("p", { class: "empty-state__privacy" }, t("app.privacy"))))
      : null;
    replaceChildren(this.body,
      phone ? [summary, grid] : [grid, summary],
      empty);
    this.body.classList.toggle("calendar__body--empty", !!empty);
  }

  private onKey(e: KeyboardEvent): void {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "PageUp") this.ctx.router.go({ kind: "month", month: addMonths(this.month, -1) });
    else if (e.key === "PageDown") this.ctx.router.go({ kind: "month", month: addMonths(this.month, 1) });
    else if (e.key.toLowerCase() === "t") this.ctx.router.go({ kind: "month", month: monthOf(today()) });
    else if (e.key === "Escape") { this.picker.close(); this.preview.hide(); }
    else return;
    e.preventDefault();
  }

  /** A horizontal swipe on touch screens changes the month; vertical scrolling stays untouched. */
  private wireSwipe(): void {
    let start: { x: number; y: number } | null = null;
    this.body.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") start = { x: e.clientX, y: e.clientY }; });
    this.body.addEventListener("pointerup", (e) => {
      if (!start) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      start = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > 2 * Math.abs(dy)) {
        this.ctx.router.go({ kind: "month", month: addMonths(this.month, dx < 0 ? 1 : -1) });
      }
    });
    this.body.addEventListener("pointercancel", () => { start = null; });
  }
}

function sameMonth(ride: ActivitySummary, m: YearMonth): boolean {
  const r = monthOf(ride.day);
  return r.year === m.year && r.month === m.month;
}
