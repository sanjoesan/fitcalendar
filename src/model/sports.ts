// What the app shows for each sport: its name, colour and icon.

import type { TextKey } from "../i18n/de";
import type { IconName } from "../ui/icons";
import type { SportKind } from "./types";

export interface SportDef {
  readonly labelKey: TextKey;
  /** CSS custom property holding the sport's colour. */
  readonly colour: string;
  readonly icon: IconName;
}

export const SPORTS: Readonly<Record<SportKind, SportDef>> = {
  ride: { labelKey: "sport.ride", colour: "--sport-ride", icon: "bike" },
  run: { labelKey: "sport.run", colour: "--sport-run", icon: "run" },
  walk: { labelKey: "sport.walk", colour: "--sport-walk", icon: "walk" },
  hike: { labelKey: "sport.hike", colour: "--sport-walk", icon: "walk" },
  swim: { labelKey: "sport.swim", colour: "--sport-swim", icon: "swim" },
  other: { labelKey: "sport.other", colour: "--sport-other", icon: "activity" },
};
