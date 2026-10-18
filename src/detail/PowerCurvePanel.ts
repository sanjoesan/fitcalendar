// The power curve - the best mean power for every duration from 1 s to the ride's length - and the table of best
// efforts, both always for the whole ride, as one line (user 2026-10-18: "nur eine linie"). A row zooms to where the
// effort was ridden and stays marked.

import uPlot from "uplot";
import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import { readChartTheme, withAlpha } from "../charts/chartTheme";
import { athleteForRide } from "../model/athlete";
import { BEST_EFFORT_DURATIONS, bestEfforts, CURVE_DURATIONS, perSecond, type BestEffort } from "../model/power";
import { cssVar, h, replaceChildren } from "../ui/dom";
import { onThemeChange } from "../ui/theme";
import type { DetailSession } from "./DetailSession";
import { durationLabel } from "./StatsPanel";
import { markZoomRows, zoomRow } from "./zoomRow";

export class PowerCurvePanel {
  readonly element = h("section", { class: "power-curve" });
  private readonly chartHost = h("div", { class: "power-curve__chart" });
  private readonly table = h("div", { class: "power-curve__table" });
  private readonly readout = h("span", { class: "power-curve__readout" });
  private plot: uPlot | null = null;
  /** The whole ride's curve and best efforts: computed once, they do not change with the zoom. */
  private readonly wholeCurve: BestEffort[] = [];
  private readonly efforts: BestEffort[] = [];
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    const power = session.streams.channels.power;
    this.element.hidden = !power;
    if (!power) return;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const whole = perSecond(session.streams.time, power);
    this.wholeCurve = bestEfforts(whole, CURVE_DURATIONS);
    this.efforts = bestEfforts(whole, BEST_EFFORT_DURATIONS);
    this.element.append(h("header", { class: "power-curve__head" }, h("h3", {}, t("power.curve")), this.readout), this.chartHost, this.table);
    this.renderTable();
    this.disposer.add(
      session.on("view", (v) => { if (!v.live) this.showView(); }),
      ctx.athlete.on("changed", () => { this.renderTable(); if (this.plot) this.renderChart(); }),
      onThemeChange(ctx.prefs, () => { if (this.plot) this.renderChart(); }),
    );
    // Drawn once the panel is on the page and has its width (a guessed width would push the page wider).
    const observer = new ResizeObserver(() => {
      if (this.chartHost.clientWidth === 0) return;
      if (this.plot) this.plot.setSize({ width: this.width(), height: 200 });
      else this.showView();
    });
    observer.observe(this.chartHost);
    this.disposer.add(() => observer.disconnect());
  }

  dispose(): void {
    this.disposer.dispose();
    this.plot?.destroy();
  }

  private width(): number {
    return Math.max(200, this.chartHost.clientWidth);
  }

  private weight(): number | undefined {
    return athleteForRide(this.ctx.athlete.profile, this.session.summary).weight;
  }

  /** The zoom changed: only the marked effort row follows; the curve is the ride's. */
  private showView(): void {
    if (!this.plot && this.chartHost.clientWidth > 0) this.renderChart();
    markZoomRows(this.table, this.session, this.ctx.i18n.t.bind(this.ctx.i18n));
  }

  private renderChart(): void {
    const { ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const c = { fmt, t };
    const weight = this.weight();
    const theme = readChartTheme();
    const colour = cssVar("--ch-power");
    const xs = this.wholeCurve.map((p) => p.duration);
    const whole = this.wholeCurve.map((p) => p.watts);
    const perKilo = (w: number) => (weight ? ` · ${fmt.number(w / weight, 2)} W/kg` : "");

    this.plot?.destroy();
    this.plot = new uPlot({
      width: this.width(), height: 200, legend: { show: false },
      scales: { x: { distr: 3, time: false } },
      axes: [
        { stroke: theme.muted, font: theme.font, grid: { stroke: theme.grid }, ticks: { show: false },
          splits: () => [1, 5, 15, 60, 300, 1200, 3600, 14400].filter((d) => d <= (xs.at(-1) ?? 1)),
          values: (_u, v) => v.map((d) => (d == null ? "" : durationLabel(d, c))) },
        { stroke: theme.muted, font: theme.font, grid: { stroke: theme.grid }, ticks: { show: false }, size: 46 },
      ],
      series: [
        {},
        { stroke: colour, width: 2, fill: withAlpha(colour, 0.15), points: { show: true, size: 4 } },
      ],
      cursor: { y: false, drag: { x: false, y: false }, points: { size: 8 } },
      hooks: {
        setCursor: [(u) => {
          const i = u.cursor.idx;
          this.readout.textContent = i == null ? "" : `${durationLabel(xs[i]!, c)}: ${fmt.number(whole[i]!)} ${t("unit.w")}${perKilo(whole[i]!)}`;
        }],
      },
    }, [xs, whole], this.chartHost);
  }

  private renderTable(): void {
    const { session, ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const c = { fmt, t };
    const weight = this.weight();
    replaceChildren(this.table, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, h("th", {}, t("power.duration")), h("th", {}, t("unit.w")), weight ? h("th", {}, "W/kg") : null, h("th", {}, ""))),
      h("tbody", {}, this.efforts.map((e) => zoomRow(session, e.range, { kind: "effort", duration: e.duration },
        [durationLabel(e.duration, c), fmt.number(e.watts), weight ? fmt.number(e.watts / weight, 2) : null].filter((v) => v !== null), t)))));
    markZoomRows(this.table, session, t);
  }
}
