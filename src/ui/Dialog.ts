// A modal question with two answers, on the native <dialog> (focus trap and Esc come with it).

import { h } from "./dom";

export interface ConfirmOptions {
  readonly title: string;
  readonly text: string;
  readonly confirm: string;
  readonly cancel: string;
  readonly danger?: boolean;
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = h("dialog", { class: "dialog" });
    const answer = (value: boolean) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.append(
      h("h2", { class: "dialog__title" }, options.title),
      h("p", { class: "dialog__text" }, options.text),
      h("div", { class: "dialog__actions" },
        h("button", { class: "button", type: "button", onclick: () => answer(false) }, options.cancel),
        h("button", { class: options.danger ? "button button--danger" : "button button--primary", type: "button", onclick: () => answer(true) }, options.confirm),
      ),
    );
    dialog.addEventListener("cancel", (e) => { e.preventDefault(); answer(false); });
    document.body.append(dialog);
    dialog.showModal();
  });
}
