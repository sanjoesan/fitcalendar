// What every screen gets handed: the owners of the app's state. Screens never create these themselves.

import type { I18n } from "../i18n/I18n";
import type { ImportJob } from "../import/ImportJob";
import type { AthleteStore } from "../store/AthleteStore";
import type { RideRepository } from "../store/RideRepository";
import type { Toasts } from "../ui/Toast";
import type { Preferences } from "./Preferences";
import type { Router } from "./Router";

export interface AppContext {
  readonly i18n: I18n;
  readonly prefs: Preferences;
  readonly router: Router;
  readonly rides: RideRepository;
  readonly athlete: AthleteStore;
  readonly importJob: ImportJob;
  readonly toasts: Toasts;
  /** Rides added by the last import, for the calendar's short highlight. */
  readonly recentlyAdded: ReadonlySet<string>;
}

/** A screen: its content, an optional part for the top bar, and cleanup. */
export interface View {
  readonly element: HTMLElement;
  readonly toolbar?: HTMLElement;
  dispose(): void;
}
