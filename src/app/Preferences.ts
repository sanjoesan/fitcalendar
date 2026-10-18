// The viewer's choices that only shape the view (language, theme, axis, curves ...). One owner, kept in localStorage
// as a convenience - the app works the same when the browser refuses storage.

import type { ChannelKey } from "../model/types";
import type { TotalsMetric } from "../model/totals";
import { Emitter } from "./Emitter";

export type XAxis = "distance" | "time";
export type SectionTab = "laps" | "splits" | "climbs";

export interface PreferenceValues {
  readonly lang: "auto" | "de" | "en";
  readonly theme: "auto" | "light" | "dark";
  readonly xAxis: XAxis;
  /** Curves switched against their default (see ChannelDef.onByDefault). */
  readonly channelShown: Partial<Record<ChannelKey, boolean>>;
  readonly mapColour: "plain" | ChannelKey;
  /** Seconds of the moving average on the curves; 0 = off. */
  readonly smoothing: 0 | 5 | 30;
  readonly barMetric: TotalsMetric;
  readonly follow: boolean;
  readonly sectionTab: SectionTab;
  readonly splitKm: 1 | 5 | 10;
  readonly perKilo: boolean;
}

const DEFAULTS: PreferenceValues = {
  lang: "auto",
  theme: "auto",
  xAxis: "distance",
  channelShown: {},
  mapColour: "plain",
  smoothing: 0,
  barMetric: "distance",
  follow: false,
  sectionTab: "laps",
  splitKm: 5,
  perKilo: false,
};

const STORAGE_KEY = "fitcalendar.preferences";

export class Preferences extends Emitter<{ changed: keyof PreferenceValues }> {
  private values: PreferenceValues;

  constructor() {
    super();
    this.values = { ...DEFAULTS, ...readStored() };
  }

  get<K extends keyof PreferenceValues>(key: K): PreferenceValues[K] {
    return this.values[key];
  }

  set<K extends keyof PreferenceValues>(key: K, value: PreferenceValues[K]): void {
    if (this.values[key] === value) return;
    this.values = { ...this.values, [key]: value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      // storage refused (private window, blocked site data): the choice lasts for this visit
    }
    this.emit("changed", key);
  }
}

function readStored(): Partial<PreferenceValues> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<PreferenceValues>) : {};
  } catch {
    return {};
  }
}
