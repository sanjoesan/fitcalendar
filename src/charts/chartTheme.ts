// Colours and fonts of the canvas-drawn charts, read from the CSS tokens (canvas cannot use var()).

import { cssVar } from "../ui/dom";

export interface ChartTheme {
  readonly ink: string;
  readonly muted: string;
  readonly grid: string;
  readonly surface: string;
  readonly cursor: string;
  readonly select: string;
  readonly highlight: string;
  readonly lap: string;
  readonly font: string;
}

export function readChartTheme(): ChartTheme {
  return {
    ink: cssVar("--ink"),
    muted: cssVar("--muted"),
    grid: cssVar("--chart-grid"),
    surface: cssVar("--surface"),
    cursor: cssVar("--chart-cursor"),
    select: cssVar("--chart-select"),
    highlight: cssVar("--chart-highlight"),
    lap: cssVar("--chart-lap"),
    font: `12px ${cssVar("--font-ui") || "system-ui"}`,
  };
}

/** A token colour with an alpha, for fills. Works for #rrggbb tokens. */
export function withAlpha(colour: string, alpha: number): string {
  const m = colour.match(/^#([0-9a-f]{6})$/i);
  if (!m) return colour;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
