// The month title's popover: a year with arrows and its twelve months; months with rides carry a dot and their km.

import type { AppContext } from "../app/context";
import { routeHref } from "../app/Router";
import { monthOf, type YearMonth } from "../model/calendar";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";

export class MonthPicker {
  readonly element = h("div", { class: "month-picker", role: "dialog", hidden: true });
  private year: number;

  constructor(private readonly ctx: AppContext, private readonly current: YearMonth) {
    this.year = current.year;
    this.element.setAttribute("aria-label", ctx.i18n.t("calendar.pickMonth"));
    this.element.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  }

  toggle(anchor: HTMLElement): void {
    if (this.element.hidden) this.open(anchor);
    else this.close();
  }

  close(): void {
    this.element.hidden = true;
  }

  private open(anchor: HTMLElement): void {
    this.year = this.current.year;
    this.render();
    this.element.hidden = false;
    const r = anchor.getBoundingClientRect();
    this.element.style.top = `${r.bottom + 8}px`;
    this.element.style.left = `${Math.max(8, Math.min(r.left + r.width / 2 - 140, window.innerWidth - 288))}px`;
    this.element.querySelector<HTMLElement>("[aria-current]")?.focus();
    const outside = (e: PointerEvent) => {
      if (!this.element.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) {
        this.close();
        document.removeEventListener("pointerdown", outside);
      }
    };
    document.addEventListener("pointerdown", outside);
  }

  private render(): void {
    const { fmt } = this.ctx.i18n;
    const km = new Map<string, number>();
    for (const r of this.ctx.rides.all()) {
      const m = monthOf(r.day);
      if (m.year === this.year) km.set(String(m.month), (km.get(String(m.month)) ?? 0) + r.distance);
    }
    replaceChildren(this.element,
      h("div", { class: "month-picker__year" },
        h("button", { class: "icon-button", type: "button", onclick: () => { this.year--; this.render(); } }, icon("chevronLeft")),
        h("strong", {}, this.year),
        h("button", { class: "icon-button", type: "button", onclick: () => { this.year++; this.render(); } }, icon("chevronRight"))),
      h("div", { class: "month-picker__months" }, Array.from({ length: 12 }, (_, i) => {
        const month = i + 1;
        const distance = km.get(String(month));
        const isCurrent = this.year === this.current.year && month === this.current.month;
        return h("a", {
          class: `month-picker__month${distance ? " month-picker__month--rides" : ""}`,
          href: routeHref({ kind: "month", month: { year: this.year, month } }),
          "aria-current": isCurrent ? "date" : undefined,
          title: distance ? fmt.distance(distance) : undefined,
          onclick: () => this.close(),
        }, fmt.monthShort(month), distance ? h("span", { class: "month-picker__dot", "aria-hidden": "true" }) : null);
      })),
    );
  }
}
