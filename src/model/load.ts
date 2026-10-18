// Training load of a ride: Intensity Factor and Training Stress Score from its Normalized Power and the rider's FTP.

import { trainingLoad, type TrainingLoad } from "./power";
import type { ActivitySummary, AthleteValues } from "./types";

/** Null without power samples or without an FTP in the profile. */
export function rideLoad(ride: ActivitySummary, athlete: AthleteValues): TrainingLoad | null {
  const normalized = ride.power?.normalized;
  return athlete.ftp && normalized ? trainingLoad(normalized, athlete.ftp, ride.movingTime) : null;
}
