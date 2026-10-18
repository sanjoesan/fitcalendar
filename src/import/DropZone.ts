// Files dragged anywhere over the window: a full-page target shows (or, when the import window is open, its field
// lights up); dropped files and folders go into the import tray - nothing is imported before the user says so.

import type { AppContext } from "../app/context";
import { h } from "../ui/dom";
import { icon } from "../ui/icons";
import { droppedFiles } from "./droppedFiles";
import type { ImportDialog } from "./ImportDialog";

export class DropZone {
  readonly element: HTMLElement;
  /** dragenter/dragleave fire for every child; counting them keeps the overlay from flickering. */
  private depth = 0;

  constructor(ctx: AppContext, dialog: ImportDialog, onFiles: (files: File[]) => void) {
    this.element = h("div", { class: "dropzone", "aria-hidden": "true" },
      h("div", { class: "dropzone__frame" }, icon("upload", "dropzone__icon"), h("p", {}, ctx.i18n.t("tray.dropHint"))));
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    const show = (active: boolean) => {
      if (dialog.isOpen) dialog.setDragging(active);
      else this.element.classList.toggle("dropzone--active", active);
    };
    window.addEventListener("dragenter", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      this.depth++;
      show(true);
    });
    window.addEventListener("dragover", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    });
    window.addEventListener("dragleave", () => {
      this.depth = Math.max(0, this.depth - 1);
      if (this.depth === 0) show(false);
    });
    window.addEventListener("drop", (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      this.depth = 0;
      show(false);
      this.element.classList.remove("dropzone--active");
      void droppedFiles(e.dataTransfer!).then(onFiles);
    });
  }
}
