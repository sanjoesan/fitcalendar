// Training load of a ride: Intensity Factor and Training Stress Score from its Normalized Power and the rider's FTP.

import type { RideAthlete } from "./athlete";
import { trainingLoad, type TrainingLoad } from "./power";
import type { ActivitySummary } from "./types";

/** Our NP with the ride's FTP; without our own NP, the device's figures as it wrote them. Null when neither exists. */
export function rideLoad(ride: ActivitySummary, athlete: RideAthlete): TrainingLoad | null {
  const ftp = athlete.values.ftp;
  const normalized = ride.power?.normalized ?? null;
  if (ftp && normalized) return trainingLoad(normalized, ftp, ride.movingTime);
  const { intensityFactor, trainingStress } = ride.device;
  if (intensityFactor !== undefined && trainingStress !== undefined) return { intensity: intensityFactor, stress: trainingStress };
  return null;
}
