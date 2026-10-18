// The app's domain: an activity is a small summary (enough for the calendar) plus its sample streams (detail page).

export type SportKind = "ride" | "run" | "walk" | "hike" | "swim" | "other";

/** The sampled values a ride can carry besides time, distance and position. */
export type ChannelKey = "altitude" | "speed" | "heartRate" | "power" | "cadence" | "gradient" | "temperature" | "balance";

export interface ChannelStats {
  readonly mean: number;
  readonly min: number;
  readonly max: number;
}

/** Values only the recording device knows and writes into the session message; absent when it did not. */
export interface DeviceMetrics {
  readonly normalizedPower?: number;
  readonly trainingStress?: number;
  readonly intensityFactor?: number;
  readonly thresholdPower?: number;
  /** Kilojoules. */
  readonly work?: number;
  readonly trainingEffect?: number;
  readonly anaerobicTrainingEffect?: number;
  /** Share of the left pedal in percent. */
  readonly leftRightBalance?: number;
  readonly leftTorqueEffectiveness?: number;
  readonly rightTorqueEffectiveness?: number;
  readonly leftPedalSmoothness?: number;
  readonly rightPedalSmoothness?: number;
}

/** The rider's physiology: the profile's values or what a device wrote into the file. */
export interface AthleteValues {
  readonly ftp?: number;
  readonly maxHr?: number;
  readonly restHr?: number;
  readonly lthr?: number;
  readonly weight?: number;
}

export interface FileAthlete extends AthleteValues {
  /** Upper bounds of the device's heart-rate / power zones (bpm / W), when it wrote them. */
  readonly hrZoneTops?: readonly number[];
  readonly powerZoneTops?: readonly number[];
}

/** Best efforts and the like, computed once at import from the power samples. */
export interface PowerFigures {
  readonly normalized: number | null;
  /** Kilojoules. */
  readonly work: number;
  /** Best mean power per duration (seconds). */
  readonly bestEfforts: readonly { readonly duration: number; readonly watts: number }[];
}

export type ChannelStatsMap = Partial<Record<ChannelKey, ChannelStats>>;

/** A ride in small: what the calendar, the previews and the detail header need without loading the streams. */
export interface ActivitySummary {
  readonly id: string;
  /** Identifies the recording itself (from file_id); null when the file has none. Used to spot duplicates. */
  readonly fileKey: string | null;
  /** The ride's name from the file or its file name; null: none, the UI shows the sport's name. */
  readonly title: string | null;
  readonly fileName: string;
  readonly sport: SportKind;
  /** Recorded on a trainer or in a virtual world. */
  readonly indoor: boolean;
  readonly deviceName: string | null;
  /** Epoch milliseconds of the first sample. */
  readonly start: number;
  /** Minutes east of UTC at the ride, from the file or the browser at import. */
  readonly tzOffsetMin: number;
  /** Local calendar day of the start, YYYY-MM-DD. */
  readonly day: string;
  /** Metres. */
  readonly distance: number;
  /** Seconds while moving (the timer). */
  readonly movingTime: number;
  /** Seconds from start to finish. */
  readonly elapsedTime: number;
  readonly ascent: number;
  readonly descent: number;
  readonly calories: number | null;
  readonly channels: ChannelStatsMap;
  /** Null without power samples. */
  readonly power: PowerFigures | null;
  readonly device: DeviceMetrics;
  readonly fileAthlete: FileAthlete;
  readonly lapCount: number;
  /** A simplified track ([lat, lon] pairs, empty without GPS) and elevation profile for previews. */
  readonly preview: RidePreviewData;
  readonly importedAt: number;
  /** Which parser built this; older summaries are rebuilt from the stored file. */
  readonly parserVersion: number;
}

export interface RidePreviewData {
  readonly track: readonly (readonly [number, number])[];
  readonly elevation: readonly number[];
}

/** A lap as an inclusive range of sample indices. */
export interface SampleRange {
  readonly from: number;
  readonly to: number;
}

export interface ActivityStreams {
  readonly id: string;
  /** Seconds since the first sample. */
  readonly time: Float64Array;
  /** Metres since the start; null when the file has neither distance, positions nor speed. */
  readonly distance: Float64Array | null;
  /** Degrees; NaN where a sample has no position. Null when the ride has no track. */
  readonly lat: Float64Array | null;
  readonly lon: Float64Array | null;
  /** SI units (m, m/s, bpm, W, rpm, °C); NaN where a sample has no value. Only channels the file carries. */
  readonly channels: Partial<Record<ChannelKey, Float64Array>>;
  readonly laps: readonly SampleRange[];
}

export interface Activity {
  readonly summary: ActivitySummary;
  readonly streams: ActivityStreams;
}
