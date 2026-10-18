// The numbers of the detail page: the tile row on top and the full statistics in groups. Both follow the view:
// while a stretch is dragged or zoomed, every value is the stretch's, with the whole ride's in small underneath.

import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import { h, replaceChildren } from "../ui/dom";
import type { DetailSession } from "./DetailSession";
import { computeFigures, type Figures } from "./figures";
import { STAT_GROUPS, TILES, statValue, type StatContext, type StatDef } from "./statDefs";

export class StatsPanel {
  readonly tiles = h("section", { class: "tiles-area" });
  readonly groups = h("section", { class: "stat-groups" });
  private frame = 0;
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    this.disposer.add(
      session.on("view", () => this.schedule()),
      session.on("preview", () => this.schedule()),
      ctx.athlete.on("changed", () => this.render()),
      () => cancelAnimationFrame(this.frame),
    );
    this.render();
  }

  dispose(): void {
    this.disposer.dispose();
  }

  /** Drags fire many events; one render per frame is enough. */
  private schedule(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }

  private render(): void {
    const { session, ctx } = this;
    const profile = ctx.athlete.profile;
    const whole = computeFigures(session.summary, session.streams, session.whole, profile);
    const range = session.preview ?? session.view;
    const figures = range.from === whole.range.from && range.to === whole.range.to ? whole : computeFigures(session.summary, session.streams, range, profile);
    const c: StatContext = { fmt: ctx.i18n.fmt, t: ctx.i18n.t.bind(ctx.i18n) };
    replaceChildren(this.tiles,
      // The "Gesamt" lines keep their space while hidden: a drag must not move the profiles under the pointer.
      h("div", { class: "tiles" }, TILES.flatMap((tile) => {
        const v = statValue(tile.main, figures);
        if (v === null) return [];
        const second = tile.second ? statValue(tile.second.stat, figures) : null;
        const totalValue = statValue(tile.main, whole);
        return [h("div", { class: "tile" },
          h("span", { class: "tile__label" }, c.t(tile.main.labelKey)),
          h("strong", { class: "tile__value" }, tile.main.format(v, c)),
          second != null && tile.second ? h("span", { class: "tile__second" }, c.t(tile.second.lineKey, { v: tile.second.stat.format(second, c) })) : null,
          h("span", { class: figures.whole ? "tile__whole tile__whole--idle" : "tile__whole" },
            totalValue != null ? c.t("stat.whole", { v: tile.main.format(totalValue, c) }) : ""),
        )];
      })),
    );
    replaceChildren(this.groups, STAT_GROUPS.flatMap((group) => {
      const rows = group.stats.flatMap((s) => this.row(s, figures, c));
      return rows.length === 0 ? [] : [h("section", { class: "stat-group" }, h("h3", {}, c.t(group.titleKey)), h("dl", {}, rows))];
    }));
  }

  private row(stat: StatDef, f: Figures, c: StatContext): HTMLElement[] {
    const v = statValue(stat, f);
    if (v === null) return [];
    return [
      h("dt", {}, c.t(stat.labelKey)),
      h("dd", {}, stat.format(v, c)),
    ];
  }
}

/** 5 s, 1 min, 20 min, 1 h */
export function durationLabel(seconds: number, c: StatContext): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${c.fmt.number(seconds / 60)} min`;
  return `${c.fmt.number(seconds / 3600, seconds % 3600 ? 1 : 0)} h`;
}
