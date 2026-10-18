// The language and theme switches - in the top bar and, on phones, on the profile page.

import type { AppContext } from "../app/context";
import type { PreferenceValues } from "../app/Preferences";
import type { Lang } from "../i18n/I18n";
import { h } from "./dom";
import { icon } from "./icons";

interface Option<V> {
  readonly value: V;
  readonly content: string | SVGElement;
  readonly title: string;
}

function segmented<V>(label: string, options: readonly Option<V>[], current: V, choose: (value: V) => void): HTMLElement {
  return h("div", { class: "segmented segmented--small", role: "radiogroup", "aria-label": label },
    options.map((o) => h("button", {
      type: "button", role: "radio", class: "segmented__option", title: o.title, "aria-checked": String(o.value === current),
      onclick: () => choose(o.value),
    }, o.content)));
}

export function languageSwitch(ctx: AppContext): HTMLElement {
  const choose = (lang: Lang) => {
    ctx.prefs.set("lang", lang);
    ctx.i18n.setLang(lang);
  };
  return segmented<Lang>(ctx.i18n.t("lang.label"), [
    { value: "de", content: "DE", title: "Deutsch" },
    { value: "en", content: "EN", title: "English" },
  ], ctx.i18n.lang, choose);
}

export function themeSwitch(ctx: AppContext, onChange: () => void): HTMLElement {
  const t = ctx.i18n.t.bind(ctx.i18n);
  return segmented<PreferenceValues["theme"]>(t("theme.label"), [
    { value: "auto", content: icon("auto"), title: t("theme.auto") },
    { value: "light", content: icon("sun"), title: t("theme.light") },
    { value: "dark", content: icon("moon"), title: t("theme.dark") },
  ], ctx.prefs.get("theme"), (theme) => { ctx.prefs.set("theme", theme); onChange(); });
}
