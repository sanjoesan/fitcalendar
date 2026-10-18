// The import's progress and outcome per file, in a drawer at the bottom corner (a bottom sheet on phones).

import type { AppContext } from "../app/context";
import { monthOf } from "../model/calendar";
import { routeHref } from "../app/Router";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import type { ImportProgress, ImportResult } from "./ImportJob";

const AUTO_CLOSE_MS = 6000;

export class ImportPanel {
  readonly element = h("section", { class: "import-panel", "aria-live": "polite", hidden: true });
  private closeTimer: ReturnType<typeof setTimeout> | null = null;
  /** After an import the list folds away to its summary line; the line opens it again. */
  private collapsed = false;

  constructor(private readonly ctx: AppContext) {
    ctx.importJob.on("progress", (p) => this.render(p));
    ctx.importJob.on("finished", (p) => this.finished(p));
  }

  private render({ results, running }: ImportProgress): void {
    if (results.length === 0) {
      this.element.hidden = true;
      return;
    }
    const tr = this.ctx.i18n.t.bind(this.ctx.i18n);
    const done = results.filter((r) => r.status !== "waiting" && r.status !== "parsing").length;
    this.element.hidden = false;
    if (running) this.collapsed = false;
    this.element.classList.toggle("import-panel--collapsed", this.collapsed);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    const counts = {
      added: results.filter((r) => r.status === "added").length,
      duplicates: results.filter((r) => r.status === "duplicate").length,
      errors: results.filter((r) => r.status === "error").length,
    };
    replaceChildren(this.element,
      h("header", { class: "import-panel__head" },
        h("button", { class: "import-panel__toggle", type: "button", "aria-expanded": String(!this.collapsed), disabled: running,
          onclick: () => { this.collapsed = !this.collapsed; this.render(this.ctx.importJob.progress); } },
          h("strong", {}, tr("import.title", { done, total: results.length }))),
        running ? null : h("span", { class: "import-panel__summary" }, tr("import.summary", counts)),
        h("button", { class: "icon-button", type: "button", title: tr("action.close"), disabled: running, onclick: () => this.ctx.importJob.clear() }, icon("close"))),
      h("div", { class: "progress", role: "progressbar", "aria-valuemin": 0, "aria-valuemax": results.length, "aria-valuenow": done },
        h("div", { class: "progress__bar" })),
      h("ul", { class: "import-panel__list" }, results.map((r) => this.row(r))),
    );
    const bar = this.element.querySelector<HTMLElement>(".progress__bar");
    if (bar) bar.style.inlineSize = `${(done / results.length) * 100}%`;
  }

  private row(result: ImportResult): HTMLElement {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const status = {
      waiting: "…",
      parsing: t("import.parsing"),
      added: t("import.added"),
      duplicate: t("import.duplicate"),
      error: t(`import.error.${result.errorCode ?? "unknown"}`),
    }[result.status];
    const link = result.rideId ? h("a", { href: routeHref({ kind: "ride", id: result.rideId, view: null }), class: "import-panel__open" }, t("action.open")) : null;
    const monthLink = result.day && result.status === "added"
      ? h("a", { href: routeHref({ kind: "month", month: monthOf(result.day) }), class: "import-panel__day" }, this.ctx.i18n.fmt.dayMonth(result.day))
      : null;
    return h("li", { class: `import-row import-row--${result.status}` },
      h("span", { class: "import-row__dot", "aria-hidden": "true" }),
      h("span", { class: "import-row__name", title: result.fileName }, result.fileName),
      h("span", { class: "import-row__status" }, status),
      monthLink, link);
  }

  private finished(progress: ImportProgress): void {
    const added = progress.results.filter((r) => r.status === "added");
    // One new ride: show its month. Several: stay where the user is.
    if (added.length === 1 && added[0]!.day && this.ctx.router.route.kind === "month") {
      this.ctx.router.go({ kind: "month", month: monthOf(added[0]!.day) });
    }
    // Without errors the panel goes away; with errors it folds to its summary line and stays.
    this.closeTimer = setTimeout(() => {
      if (progress.results.every((r) => r.status !== "error")) this.ctx.importJob.clear();
      else { this.collapsed = true; this.render(this.ctx.importJob.progress); }
    }, AUTO_CLOSE_MS);
  }
}
