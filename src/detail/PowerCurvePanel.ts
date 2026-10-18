// The power curve - the best mean power for every duration from 1 s to the stretch's length - and the table of best
// efforts. A row jumps to where the effort was ridden. When zoomed, the whole ride's curve is drawn faintly behind.

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

export class PowerCurvePanel {
  readonly element = h("section", { class: "power-curve" });
  private readonly chartHost = h("div", { class: "power-curve__chart" });
  private readonly table = h("div", { class: "power-curve__table" });
  private readonly readout = h("span", { class: "power-curve__readout" });
  private plot: uPlot | null = null;
  private wholeCurve: BestEffort[] = [];
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    const power = session.streams.channels.power;
    this.element.hidden = !power;
    if (!power) return;
    const t = ctx.i18n.t.bind(ctx.i18n);
    this.wholeCurve = bestEfforts(perSecond(session.streams.time, power), CURVE_DURATIONS);
    this.element.append(h("header", { class: "power-curve__head" }, h("h3", {}, t("power.curve")), this.readout), this.chartHost, this.table);
    this.disposer.add(
      session.on("view", (v) => { if (!v.live && this.plot) this.render(); }),
      ctx.athlete.on("changed", () => { if (this.plot) this.render(); }),
      onThemeChange(ctx.prefs, () => { if (this.plot) this.render(); }),
    );
    // Drawn once the panel is on the page and has its width (a guessed width would push the page wider).
    const observer = new ResizeObserver(() => {
      if (this.chartHost.clientWidth === 0) return;
      if (this.plot) this.plot.setSize({ width: this.width(), height: 200 });
      else this.render();
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

  private render(): void {
    const { session, ctx } = this;
    const { fmt } = ctx.i18n;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const series = perSecond(session.streams.time, session.streams.channels.power!, session.view);
    const curve = session.isZoomed ? bestEfforts(series, CURVE_DURATIONS) : this.wholeCurve;
    const weight = athleteForRide(ctx.athlete.profile, session.summary).weight;
    const c = { fmt, t };

    this.plot?.destroy();
    const theme = readChartTheme();
    const colour = cssVar("--ch-power");
    const xs = this.wholeCurve.map((p) => p.duration);
    const current = xs.map((d) => curve.find((p) => p.duration === d)?.watts ?? null);
    const seriesList: uPlot.Series[] = [{}, { stroke: colour, width: 2, fill: withAlpha(colour, 0.15), points: { show: true, size: 4 } }];
    const data: uPlot.AlignedData = [xs, current];
    if (session.isZoomed) {
      seriesList.push({ stroke: theme.muted, width: 1, dash: [4, 4], points: { show: false } });
      data.push(this.wholeCurve.map((p) => p.watts));
    }
    this.plot = new uPlot({
      width: this.width(), height: 200, legend: { show: false },
      scales: { x: { distr: 3, time: false } },
      axes: [
        { stroke: theme.muted, font: theme.font, grid: { stroke: theme.grid }, ticks: { show: false },
          splits: () => [1, 5, 15, 60, 300, 1200, 3600, 14400].filter((d) => d <= (xs.at(-1) ?? 1)),
          values: (_u, v) => v.map((d) => (d == null ? "" : durationLabel(d, c))) },
        { stroke: theme.muted, font: theme.font, grid: { stroke: theme.grid }, ticks: { show: false }, size: 46 },
      ],
      series: seriesList,
      cursor: { y: false, drag: { x: false, y: false }, points: { size: 8, fill: colour } },
      hooks: {
        setCursor: [(u) => {
          const i = u.cursor.idx;
          const w = i == null ? null : current[i];
          this.readout.textContent = i == null || w == null ? "" : `${durationLabel(xs[i]!, c)}: ${fmt.number(w)} ${t("unit.w")}${weight ? ` · ${fmt.number(w / weight, 2)} W/kg` : ""}`;
        }],
      },
    }, data, this.chartHost);

    const efforts = bestEfforts(series, BEST_EFFORT_DURATIONS);
    replaceChildren(this.table, h("table", { class: "table" },
      h("thead", {}, h("tr", {}, h("th", {}, t("power.duration")), h("th", {}, t("unit.w")), weight ? h("th", {}, "W/kg") : null, h("th", {}, ""))),
      h("tbody", {}, efforts.map((e) => {
        const row = h("tr", { class: "table__row--link", tabindex: 0 },
          h("td", {}, durationLabel(e.duration, c)),
          h("td", {}, fmt.number(e.watts)),
          weight ? h("td", {}, fmt.number(e.watts / weight, 2)) : null,
          h("td", { class: "table__hint" }, t("power.show")));
        const go = () => session.zoomTo(e.range, "section", { kind: "effort", duration: e.duration });
        row.addEventListener("click", go);
        row.addEventListener("keydown", (ev) => { if (ev.key === "Enter") go(); });
        row.addEventListener("pointerenter", () => session.hoverSection(e.range));
        row.addEventListener("pointerleave", () => session.hoverSection(null));
        return row;
      }))));
  }
}
