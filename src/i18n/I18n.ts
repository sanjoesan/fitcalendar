// The current language: its texts and its number/date formatting. Changing it re-renders the app.

import { Emitter } from "../app/Emitter";
import { de, type TextKey } from "./de";
import { en } from "./en";
import { Formatter } from "./format";

export type Lang = "de" | "en";

const TABLES: Readonly<Record<Lang, Readonly<Record<TextKey, string>>>> = { de, en };

export function detectLang(languages: readonly string[] = navigator.languages): Lang {
  for (const l of languages) {
    const code = l.slice(0, 2).toLowerCase();
    if (code === "de" || code === "en") return code;
  }
  return "en";
}

export class I18n extends Emitter<{ change: Lang }> {
  private current: Lang;
  private formatter: Formatter;

  constructor(lang: Lang) {
    super();
    this.current = lang;
    this.formatter = new Formatter(lang, (k, p) => this.t(k, p));
    document.documentElement.lang = lang;
  }

  get lang(): Lang {
    return this.current;
  }

  get fmt(): Formatter {
    return this.formatter;
  }

  setLang(lang: Lang): void {
    if (lang === this.current) return;
    this.current = lang;
    this.formatter = new Formatter(lang, (k, p) => this.t(k, p));
    document.documentElement.lang = lang;
    this.emit("change", lang);
  }

  /** The text for a key, with {name} placeholders filled from params. */
  t(key: TextKey, params: Readonly<Record<string, string | number>> = {}): string {
    return TABLES[this.current][key].replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  }
}
