// A ride's name for display: its own, or the sport's name.

import type { I18n } from "../i18n/I18n";
import { SPORTS } from "../model/sports";
import type { ActivitySummary } from "../model/types";

export function rideTitle(i18n: I18n, ride: ActivitySummary): string {
  return ride.title ?? i18n.t(SPORTS[ride.sport].labelKey);
}
