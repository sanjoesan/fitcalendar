// Every channel a ride can carry, as data: label, unit, colour, how it is drawn and shown.
// Tiles, chart panes, toggle chips, the map's colouring and the cursor read-outs all iterate this list.

import type { TextKey } from "../i18n/de";
import type { ChannelKey } from "./types";

export interface ChannelDef {
  readonly key: ChannelKey;
  readonly labelKey: TextKey;
  readonly unitKey: TextKey;
  /** CSS custom property holding the channel's colour. */
  readonly colour: string;
  /** SI value → shown value (m/s → km/h, fraction → %). */
  readonly display: (si: number) => number;
  readonly digits: number;
  readonly chart: "area" | "line";
  /** A pane is shown for it until the user switches it off. */
  readonly onByDefault: boolean;
  /** The moving average of the smoothing setting applies to it. */
  readonly smoothable: boolean;
  /** The map can colour the track by it. */
  readonly colourable: boolean;
  /** The tile shows a maximum next to the mean. */
  readonly showMax: boolean;
  /** A 0 is a missing sensor reading, not a value (no heart beats at 0 bpm). */
  readonly zeroIsMissing: boolean;
}

const identity = (v: number): number => v;

export const CHANNELS: readonly ChannelDef[] = [
  { key: "altitude", labelKey: "channel.altitude", unitKey: "unit.m", colour: "--ch-altitude", display: identity, digits: 0,
    chart: "area", onByDefault: true, smoothable: false, colourable: true, showMax: true, zeroIsMissing: false },
  { key: "speed", labelKey: "channel.speed", unitKey: "unit.kmh", colour: "--ch-speed", display: (v) => v * 3.6, digits: 1,
    chart: "line", onByDefault: true, smoothable: true, colourable: true, showMax: true, zeroIsMissing: false },
  { key: "heartRate", labelKey: "channel.heartRate", unitKey: "unit.bpm", colour: "--ch-heart", display: identity, digits: 0,
    chart: "line", onByDefault: true, smoothable: true, colourable: true, showMax: true, zeroIsMissing: true },
  { key: "power", labelKey: "channel.power", unitKey: "unit.w", colour: "--ch-power", display: identity, digits: 0,
    chart: "line", onByDefault: true, smoothable: true, colourable: true, showMax: true, zeroIsMissing: false },
  { key: "cadence", labelKey: "channel.cadence", unitKey: "unit.rpm", colour: "--ch-cadence", display: identity, digits: 0,
    chart: "line", onByDefault: true, smoothable: true, colourable: false, showMax: false, zeroIsMissing: false },
  { key: "gradient", labelKey: "channel.gradient", unitKey: "unit.percent", colour: "--ch-gradient", display: (v) => v * 100,
    digits: 1, chart: "line", onByDefault: false, smoothable: false, colourable: true, showMax: true, zeroIsMissing: false },
  { key: "temperature", labelKey: "channel.temperature", unitKey: "unit.celsius", colour: "--ch-temperature", display: identity,
    digits: 0, chart: "line", onByDefault: false, smoothable: false, colourable: false, showMax: true, zeroIsMissing: false },
  { key: "balance", labelKey: "channel.balance", unitKey: "unit.percentLeft", colour: "--ch-balance", display: identity,
    digits: 0, chart: "line", onByDefault: false, smoothable: true, colourable: false, showMax: false, zeroIsMissing: false },
];

export function channelDef(key: ChannelKey): ChannelDef {
  return CHANNELS.find((c) => c.key === key)!;
}
