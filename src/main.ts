// Composition root: opens the database, creates the owners of the app's state and starts the app.

import "leaflet/dist/leaflet.css";
import "uplot/dist/uPlot.min.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/calendar.css";
import "./styles/detail.css";
import "./styles/profile.css";

import { App } from "./app/App";
import type { AppContext } from "./app/context";
import { Preferences } from "./app/Preferences";
import { Router } from "./app/Router";
import { detectLang, I18n } from "./i18n/I18n";
import { ImportJob } from "./import/ImportJob";
import { AthleteStore } from "./store/AthleteStore";
import { Database } from "./store/Database";
import { RideRepository } from "./store/RideRepository";
import { h, replaceChildren } from "./ui/dom";
import { Toasts } from "./ui/Toast";

/** How long freshly imported rides stay highlighted in the calendar. */
const HIGHLIGHT_MS = 4000;

async function start(root: HTMLElement): Promise<void> {
  const prefs = new Preferences();
  const lang = prefs.get("lang");
  const i18n = new I18n(lang === "auto" ? detectLang() : lang);
  try {
    const db = await Database.open();
    const [rides, athlete] = await Promise.all([RideRepository.open(db), AthleteStore.open(db)]);
    const recentlyAdded = new Set<string>();
    rides.on("changed", ({ added }) => {
      for (const id of added) recentlyAdded.add(id);
      setTimeout(() => added.forEach((id) => recentlyAdded.delete(id)), HIGHLIGHT_MS);
    });
    const ctx: AppContext = {
      i18n, prefs, rides, athlete, recentlyAdded,
      router: new Router(),
      importJob: new ImportJob(rides),
      toasts: new Toasts(),
    };
    new App(root, ctx).start();
  } catch {
    replaceChildren(root, h("div", { class: "notice" }, h("p", {}, i18n.t("calendar.loadError")),
      h("button", { class: "button", type: "button", onclick: () => location.reload() }, i18n.t("action.retry"))));
  }
}

void start(document.getElementById("app")!);
