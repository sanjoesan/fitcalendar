// Calendar arithmetic on plain day keys (YYYY-MM-DD): local days, ISO weeks, the weeks of a month.

export interface YearMonth {
  readonly year: number;
  /** 1 … 12 */
  readonly month: number;
}

const pad = (n: number): string => String(n).padStart(2, "0");

export function dayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** The calendar day of an instant at a UTC offset. */
export function localDay(epochMs: number, tzOffsetMin: number): string {
  const d = new Date(epochMs + tzOffsetMin * 60_000);
  return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Today in the browser's time zone. */
export function today(now: Date = new Date()): string {
  return dayKey(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function parseDay(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split("-").map(Number);
  return { year: y!, month: m!, day: d! };
}

export function monthOf(key: string): YearMonth {
  const { year, month } = parseDay(key);
  return { year, month };
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareMonths(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

/** Days are counted in UTC so daylight saving time never shifts them. */
function utcDate(key: string): Date {
  const { year, month, day } = parseDay(key);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDays(key: string, delta: number): string {
  const d = utcDate(key);
  d.setUTCDate(d.getUTCDate() + delta);
  return dayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** 0 = Monday … 6 = Sunday */
export function weekday(key: string): number {
  return (utcDate(key).getUTCDay() + 6) % 7;
}

/** The ISO 8601 week number (weeks start on Monday; week 1 holds the year's first Thursday). */
export function isoWeek(key: string): number {
  const thursday = utcDate(addDays(key, 3 - weekday(key)));
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / 86_400_000 / 7) + 1;
}

/** The Mondays of the weeks shown for a month: from the week of the 1st to the week of the last day. */
export function weeksOfMonth({ year, month }: YearMonth): string[] {
  const first = dayKey(year, month, 1);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = dayKey(year, month, lastDay);
  const mondays: string[] = [];
  for (let monday = addDays(first, -weekday(first)); monday <= last; monday = addDays(monday, 7)) mondays.push(monday);
  return mondays;
}

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}
