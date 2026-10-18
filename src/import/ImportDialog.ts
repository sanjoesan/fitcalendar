// The import window: a large field to drop files or folders into (or to choose them - several at once, or a whole
// folder), the list of what was laid down, and the button that starts the import.

import type { AppContext } from "../app/context";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import type { ImportTray, TrayState } from "./ImportTray";

export class ImportDialog {
  readonly element = h("dialog", { class: "dialog import-dialog" });
  private readonly field = h("div", { class: "import-field" });
  private readonly list = h("div", { class: "import-dialog__files" });
  private readonly footer = h("div", { class: "dialog__actions import-dialog__actions" });
  private readonly filesInput = h("input", { type: "file", accept: ".fit,.FIT", multiple: true, hidden: true });
  private readonly folderInput = h("input", { type: "file", multiple: true, hidden: true, webkitdirectory: true });

  constructor(private readonly ctx: AppContext, private readonly tray: ImportTray, private readonly startImport: (files: File[]) => void) {
    const t = ctx.i18n.t.bind(ctx.i18n);
    for (const input of [this.filesInput, this.folderInput]) {
      input.addEventListener("change", () => {
        tray.add([...(input.files ?? [])]);
        input.value = "";
      });
    }
    replaceChildren(this.field,
      icon("upload", "import-field__icon"),
      h("strong", {}, t("tray.drop")),
      h("span", { class: "import-field__or" }, t("tray.or")),
      h("div", { class: "import-field__buttons" },
        h("button", { class: "button", type: "button", onclick: () => this.filesInput.click() }, t("tray.chooseFiles")),
        h("button", { class: "button", type: "button", onclick: () => this.folderInput.click() }, t("tray.chooseFolder"))),
      h("span", { class: "import-field__hint" }, t("tray.hint")));
    this.element.append(
      h("header", { class: "import-dialog__head" },
        h("h2", {}, t("action.import")),
        h("button", { class: "icon-button", type: "button", title: t("action.close"), onclick: () => this.close() }, icon("close"))),
      this.field, this.list, this.footer, this.filesInput, this.folderInput);
    this.element.addEventListener("cancel", (e) => { e.preventDefault(); this.close(); });
    // a click on the backdrop closes the window
    this.element.addEventListener("click", (e) => { if (e.target === this.element) this.close(); });
    tray.on("changed", (state) => this.render(state));
    this.render(tray.state);
  }

  get isOpen(): boolean {
    return this.element.open;
  }

  open(): void {
    if (!this.element.open) this.element.showModal();
  }

  close(): void {
    this.element.close();
  }

  /** Files dragged over the page while the window is open light up the field. */
  setDragging(active: boolean): void {
    this.field.classList.toggle("import-field--active", active);
  }

  private render({ files, skipped }: TrayState): void {
    const { fmt } = this.ctx.i18n;
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const totalBytes = files.reduce((s, f) => s + f.size, 0);
    replaceChildren(this.list,
      files.length === 0 ? null : h("div", { class: "import-dialog__summary" },
        h("span", {}, t("tray.count", { n: files.length, size: `${fmt.number(totalBytes / 1_048_576, 1)} MB` })),
        h("button", { class: "button button--quiet", type: "button", onclick: () => this.tray.clear() }, t("tray.clear"))),
      files.length === 0 ? null : h("ul", { class: "import-dialog__list" }, [...files].sort((a, b) => a.name.localeCompare(b.name)).map((file) =>
        h("li", { class: "tray-file" },
          h("span", { class: "tray-file__name", title: file.name }, file.name),
          h("span", { class: "tray-file__size" }, `${fmt.number(file.size / 1024)} KB`),
          h("button", { class: "icon-button icon-button--small", type: "button", title: t("tray.remove"), onclick: () => this.tray.remove(file) }, icon("close"))))),
      skipped > 0 ? h("p", { class: "import-dialog__skipped" }, t("tray.skipped", { n: skipped })) : null,
    );
    replaceChildren(this.footer,
      h("span", { class: "import-dialog__privacy" }, t("app.privacy")),
      h("button", { class: "button", type: "button", onclick: () => this.close() }, t("action.cancel")),
      h("button", {
        class: "button button--primary", type: "button", disabled: files.length === 0,
        onclick: () => { this.startImport(this.tray.take()); this.close(); },
      }, icon("upload"), files.length === 1 ? t("tray.importOne") : t("tray.importMany", { n: files.length })));
  }
}
