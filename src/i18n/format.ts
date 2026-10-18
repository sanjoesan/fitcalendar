// How numbers, durations and dates are written in a language. Every visible number goes through here.

import type { ChannelDef } from "../model/channels";
import type { TextKey } from "./de";

type Translate = (key: TextKey, params?: Readonly<Record<string, string | number>>) => string;

export class Formatter {
  private readonly numbers = new Map<number, Intl.NumberFormat>();

  constructor(readonly locale: string, private readonly t: Translate) {}

  number(value: number, digits = 0): string {
    let f = this.numbers.get(digits);
    if (!f) this.numbers.set(digits, (f = new Intl.NumberFormat(this.locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })));
    return f.format(value);
  }

  /** 42,3 km; under 10 km with two digits. */
  distance(metres: number): string {
    const km = metres / 1000;
    return `${this.number(km, km < 10 ? 2 : 1)} ${this.t("unit.km")}`;
  }

  /** Just the km number, for axes and compact chips. */
  km(metres: number, digits = 1): string {
    return this.number(metres / 1000, digits);
  }

  /** 1:38 h, 38 min - the calendar's short form. */
  durationShort(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")} h`;
  }

  /** 1:38:05 or 38:05 - the detail page's exact form. */
  duration(seconds: number): string {
    const s = Math.round(seconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  }

  /** 1:05 - hours and minutes, for time axes. */
  hoursMinutes(seconds: number): string {
    const m = Math.round(seconds / 60);
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
  }

  ascent(metres: number): string {
    return `${this.number(Math.round(metres))} ${this.t("unit.m")}`;
  }

  /** A channel's value in its unit, e.g. "28,4 km/h". */
  channel(def: ChannelDef, si: number, withUnit = true): string {
    const value = this.number(def.display(si), def.digits);
    return withUnit ? `${value} ${this.t(def.unitKey)}` : value;
  }

  /** Dates of a ride are shown in the ride's own time zone. */
  private rideDate(epochMs: number, tzOffsetMin: number): Date {
    return new Date(epochMs + tzOffsetMin * 60_000);
  }

  rideDateLong(epochMs: number, tzOffsetMin: number): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(this.rideDate(epochMs, tzOffsetMin));
  }

  rideDateShort(epochMs: number, tzOffsetMin: number): string {
    return new Intl.DateTimeFormat(this.locale, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
      .format(this.rideDate(epochMs, tzOffsetMin));
  }

  rideTime(epochMs: number, tzOffsetMin: number): string {
    return new Intl.DateTimeFormat(this.locale, { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
      .format(this.rideDate(epochMs, tzOffsetMin));
  }

  /** "Oktober 2026" */
  monthYear(year: number, month: number): string {
    return new Intl.DateTimeFormat(this.locale, { month: "long", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  monthName(year: number, month: number): string {
    return new Intl.DateTimeFormat(this.locale, { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  monthShort(month: number): string {
    return new Intl.DateTimeFormat(this.locale, { month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 1)));
  }

  /** "13. Okt." from a day key. */
  dayMonth(dayKey: string): string {
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Intl.DateTimeFormat(this.locale, { day: "numeric", month: "short", timeZone: "UTC" })
      .format(new Date(Date.UTC(y!, m! - 1, d!)));
  }

  /** "Samstag, 17. Oktober" from a day key. */
  dayLong(dayKey: string): string {
    const [y, m, d] = dayKey.split("-").map(Number);
    return new Intl.DateTimeFormat(this.locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })
      .format(new Date(Date.UTC(y!, m! - 1, d!)));
  }

  /** +12 % / −3 % */
  change(fraction: number): string {
    const pct = Math.round(fraction * 100);
    return `${pct > 0 ? "+" : pct < 0 ? "−" : "±"}${this.number(Math.abs(pct))} %`;
  }
}
