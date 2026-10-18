// Short messages at the bottom of the page, optionally with one action (e.g. undo).

import { h } from "./dom";

export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

export class Toasts {
  readonly element = h("div", { class: "toasts", role: "status", "aria-live": "polite" });

  show(message: string, action?: ToastAction, durationMs = 6000): void {
    const toast = h("div", { class: "toast" }, h("span", {}, message));
    const close = () => {
      toast.classList.add("toast--leaving");
      setTimeout(() => toast.remove(), 200);
    };
    if (action) {
      toast.append(h("button", { class: "toast__action", type: "button", onclick: () => { action.run(); close(); } }, action.label));
    }
    this.element.append(toast);
    setTimeout(close, durationMs);
  }
}
