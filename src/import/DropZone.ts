// Files dragged over the window show a full-page drop target; dropping hands the files to the import.

import type { AppContext } from "../app/context";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";

export class DropZone {
  readonly element: HTMLElement;
  /** dragenter/dragleave fire for every child; counting them keeps the overlay from flickering. */
  private depth = 0;

  constructor(ctx: AppContext, onFiles: (files: File[]) => void) {
    this.element = h("div", { class: "dropzone", "aria-hidden": "true" },
      h("div", { class: "dropzone__frame" }, icon("upload", "dropzone__icon"), h("p", {}, ctx.i18n.t("import.dropHint"))));
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    window.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      this.depth++;
      this.element.classList.add("dropzone--active");
    });
    window.addEventListener("dragover", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    });
    window.addEventListener("dragleave", () => {
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) this.element.classList.remove("dropzone--active");
    });
    window.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      this.depth = 0;
      this.element.classList.remove("dropzone--active");
      onFiles([...(e.dataTransfer?.files ?? [])]);
    });
  }
}
