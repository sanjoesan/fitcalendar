// The export window: all original .fit files from a chosen day on, as one ZIP download.

import type { AppContext } from "../app/context";
import { monthOf, dayKey, today } from "../model/calendar";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { uniqueNames, zip } from "./zip";

export class ExportDialog {
  readonly element = h("dialog", { class: "dialog export-dialog" });
  private readonly from = h("input", { class: "input", type: "date", required: true });
  private readonly info = h("p", { class: "export-dialog__info" });
  private readonly actions = h("div", { class: "dialog__actions" });
  private busy = false;

  constructor(private readonly ctx: AppContext) {
    const t = ctx.i18n.t.bind(ctx.i18n);
    this.element.append(
      h("header", { class: "import-dialog__head" },
        h("h2", {}, t("export.title")),
        h("button", { class: "icon-button", type: "button", title: t("action.close"), onclick: () => this.close() }, icon("close"))),
      h("label", { class: "field" }, h("span", { class: "field__label" }, t("export.from")), this.from),
      this.info,
      this.actions);
    this.from.addEventListener("input", () => this.render());
    this.element.addEventListener("cancel", (e) => { e.preventDefault(); this.close(); });
    this.element.addEventListener("click", (e) => { if (e.target === this.element) this.close(); });
    ctx.rides.on("changed", () => { if (this.element.open) this.render(); });
  }

  open(): void {
    if (!this.from.value) {
      const { year, month } = monthOf(today());
      this.from.value = dayKey(year, month, 1);
    }
    this.render();
    if (!this.element.open) this.element.showModal();
  }

  close(): void {
    if (!this.busy) this.element.close();
  }

  private render(): void {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const rides = this.ctx.rides.fromDay(this.from.value);
    this.info.textContent = rides.length === 1 ? t("export.countOne") : t("export.count", { n: rides.length });
    replaceChildren(this.actions,
      h("button", { class: "button", type: "button", disabled: this.busy, onclick: () => this.close() }, t("action.cancel")),
      h("button", { class: "button button--primary", type: "button", disabled: this.busy || rides.length === 0 || !this.from.value, onclick: () => void this.download() },
        icon("download"), this.busy ? t("export.packing") : t("export.download")));
  }

  private async download(): Promise<void> {
    const from = this.from.value;
    const rides = this.ctx.rides.fromDay(from);
    this.busy = true;
    this.render();
    try {
      const files = await Promise.all(rides.map((r) => this.ctx.rides.file(r.id)));
      const present = rides.flatMap((r, i) => (files[i] ? [{ ride: r, file: files[i]! }] : []));
      const names = uniqueNames(present.map((p) => p.file.fileName));
      const archive = zip(present.map((p, i) => ({ name: names[i]!, bytes: new Uint8Array(p.file.bytes), modified: new Date(p.ride.start) })));
      const url = URL.createObjectURL(new Blob([archive], { type: "application/zip" }));
      const a = h("a", { href: url, download: `fitcalendar-ab-${from}.zip` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      this.busy = false;
      this.close();
      this.ctx.toasts.show(this.ctx.i18n.t("export.done", { n: present.length }));
    } catch {
      this.busy = false;
      this.render();
      this.ctx.toasts.show(this.ctx.i18n.t("export.failed"));
    }
  }
}
