// The month as a grid: a row per week (Monday … Sunday), the ISO week in front, the week's totals at the end.
// Arrow keys move between days (roving tabindex), Enter goes into the day's rides.

import type { AppContext } from "../app/context";
import { weekday } from "../model/calendar";
import { h } from "../ui/dom";
import type { DayModel, MonthModel, WeekModel } from "./MonthModel";
import { rideChip } from "./RideChip";

const MAX_CHIPS = 3;

export function monthGrid(ctx: AppContext, model: MonthModel, compact: boolean): HTMLElement {
  const t = ctx.i18n.t.bind(ctx.i18n);
  const grid = h("div", { class: "month-grid", role: "grid", "aria-label": ctx.i18n.fmt.monthYear(model.month.year, model.month.month) },
    h("div", { class: "month-grid__row month-grid__head", role: "row" },
      h("span", { class: "month-grid__weeknum", role: "columnheader" }, ""),
      Array.from({ length: 7 }, (_, i) => h("span", { role: "columnheader", class: i >= 5 ? "weekend" : undefined }, t(`weekday.short.${i}` as "weekday.short.0"))),
      h("span", { role: "columnheader", class: "month-grid__totalshead" }, t("calendar.week"))),
    model.weeks.map((week) => weekRow(ctx, week, compact)),
  );
  wireKeyboard(grid);
  return grid;
}

function weekRow(ctx: AppContext, week: WeekModel, compact: boolean): HTMLElement {
  return h("div", { class: "month-grid__row week", role: "row" },
    h("span", { class: "month-grid__weeknum", role: "rowheader" }, ctx.i18n.t("calendar.weekShort", { n: week.isoWeek })),
    week.days.map((day) => dayCell(ctx, day, compact)),
    weekTotals(ctx, week),
  );
}

function dayCell(ctx: AppContext, day: DayModel, compact: boolean): HTMLElement {
  const classes = ["day"];
  if (!day.inMonth) classes.push("day--out");
  if (day.isToday) classes.push("day--today");
  if (weekday(day.key) >= 5) classes.push("weekend");
  const hidden = day.rides.length - MAX_CHIPS;
  const cell = h("div", {
    class: classes.join(" "), role: "gridcell", tabindex: day.isToday ? 0 : -1, "data-day": day.key,
    "aria-label": ctx.i18n.fmt.dayLong(day.key),
  },
    h("span", { class: "day__num" }, day.dayOfMonth),
    h("div", { class: "day__rides" }, day.rides.map((r, i) => {
      const chip = rideChip(ctx, r, compact);
      if (i >= MAX_CHIPS && hidden > 1) chip.classList.add("chip--overflow");
      return chip;
    })),
  );
  if (hidden > 1) {
    const more = h("button", { class: "day__more", type: "button" }, ctx.i18n.t("calendar.more", { n: hidden }));
    more.addEventListener("click", () => { cell.classList.add("day--expanded"); more.remove(); });
    cell.append(more);
  }
  return cell;
}

function weekTotals(ctx: AppContext, week: WeekModel): HTMLElement {
  const { fmt } = ctx.i18n;
  const t = ctx.i18n.t.bind(ctx.i18n);
  const { totals } = week;
  if (totals.count === 0) return h("div", { class: "week__totals week__totals--empty", role: "gridcell" }, h("span", {}, "–"));
  return h("div", { class: "week__totals", role: "gridcell" },
    h("strong", { class: "week__distance" }, fmt.distance(totals.distance)),
    h("span", { class: "week__line" }, `${fmt.durationShort(totals.movingTime)} · ↑${fmt.ascent(totals.ascent)}`),
    h("span", { class: "week__line week__line--muted" },
      totals.count === 1 ? t("calendar.ride") : t("calendar.rides", { n: totals.count }),
      totals.stress > 0 ? ` · ${fmt.number(totals.stress)} TSS` : ""),
  );
}

/** Arrow keys between days, Home/End to the week's ends; Enter focuses the day's first ride. */
function wireKeyboard(grid: HTMLElement): void {
  grid.addEventListener("keydown", (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".day");
    if (!cell || e.target !== cell) return;
    const cells = [...grid.querySelectorAll<HTMLElement>(".day")];
    const i = cells.indexOf(cell);
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -(i % 7), End: 6 - (i % 7) };
    if (e.key in step) {
      const next = cells[Math.max(0, Math.min(cells.length - 1, i + step[e.key]!))];
      if (next) {
        e.preventDefault();
        cell.tabIndex = -1;
        next.tabIndex = 0;
        next.focus();
      }
    } else if (e.key === "Enter") {
      cell.querySelector<HTMLElement>(".chip")?.focus();
    }
  });
  if (!grid.querySelector('.day[tabindex="0"]')) grid.querySelector<HTMLElement>(".day:not(.day--out)")?.setAttribute("tabindex", "0");
}
