// A table row that stands for a stretch of the ride (lap, split, climb, best effort). Clicking it zooms there; the
// row that is the current view is marked and its button turns into "reset", back to the whole ride.

import { h, type Child } from "../ui/dom";
import type { TextKey } from "../i18n/de";
import type { DetailSession, ViewLabel } from "./DetailSession";
import type { SampleRange } from "../model/types";

type Translate = (key: TextKey) => string;

export function zoomRow(session: DetailSession, range: SampleRange, label: ViewLabel, cells: Child[], t: Translate): HTMLTableRowElement {
  const isView = () => session.view.from === range.from && session.view.to === range.to;
  const action = h("button", { class: "zoom-row__action", type: "button" }, t("action.showRow"));
  const row = h("tr", { class: "table__row--link zoom-row", tabindex: 0, "data-from": range.from, "data-to": range.to },
    cells.map((c) => h("td", {}, c)),
    h("td", { class: "zoom-row__cell" }, action));
  const toggle = () => (isView() ? session.resetZoom("section") : session.zoomTo(range, "section", label));
  row.addEventListener("click", toggle);
  row.addEventListener("keydown", (e) => { if (e.key === "Enter") toggle(); });
  row.addEventListener("pointerenter", () => session.hoverSection(range));
  row.addEventListener("pointerleave", () => session.hoverSection(null));
  row.addEventListener("focus", () => session.hoverSection(range));
  row.addEventListener("blur", () => session.hoverSection(null));
  return row;
}

/** Marks the row that is the current view and gives it the reset button; all other rows offer "show". */
export function markZoomRows(container: HTMLElement, session: DetailSession, t: Translate): void {
  const { from, to } = session.view;
  for (const row of container.querySelectorAll<HTMLElement>("tr.zoom-row")) {
    const active = Number(row.dataset.from) === from && Number(row.dataset.to) === to;
    row.classList.toggle("table__row--active", active);
    const action = row.querySelector<HTMLElement>(".zoom-row__action");
    if (action) {
      action.textContent = t(active ? "action.resetRow" : "action.showRow");
      action.classList.toggle("zoom-row__action--reset", active);
    }
  }
}
