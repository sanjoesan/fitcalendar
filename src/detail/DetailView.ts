// The detail screen of one ride: loads its streams, creates the session and the parts that subscribe to it, keeps
// the address in step with the zoom, and handles rename, download, delete (with undo) and previous/next.

import { isTyping } from "../app/App";
import type { AppContext, View } from "../app/context";
import { Disposer } from "../app/Emitter";
import { BrushStrip } from "../charts/BrushStrip";
import { ChartStack } from "../charts/ChartStack";
import { monthOf } from "../model/calendar";
import type { ActivityStreams, ActivitySummary, SampleRange } from "../model/types";
import { TrackMap } from "../map/TrackMap";
import { confirmDialog } from "../ui/Dialog";
import { h, replaceChildren } from "../ui/dom";
import { rideTitle } from "../ui/rideTitle";
import { ChartToolbar } from "./ChartToolbar";
import { backLink, detailHeader } from "./DetailHeader";
import { DetailSession } from "./DetailSession";
import { PowerCurvePanel } from "./PowerCurvePanel";
import { SectionsTable } from "./SectionsTable";
import { StatsPanel } from "./StatsPanel";
import { ZonesPanel } from "./ZonesPanel";

export class DetailView implements View {
  readonly element = h("div", { class: "detail" });
  readonly toolbar: HTMLElement | undefined;
  private readonly disposer = new Disposer();
  private session: DetailSession | null = null;

  constructor(private readonly ctx: AppContext, private readonly id: string, initialView: SampleRange | null) {
    const ride = ctx.rides.get(id);
    if (!ride) {
      this.element.append(this.message("detail.notFound"));
      return;
    }
    this.toolbar = backLink(ctx, ride);
    this.element.append(this.skeleton(ride));
    ctx.rides.streams(id).then(
      (streams) => (streams ? this.build(ride, streams, initialView) : replaceChildren(this.element, this.message("detail.loadError"))),
      () => replaceChildren(this.element, this.message("detail.loadError")),
    );
    this.disposer.add(ctx.rides.on("changed", (c) => {
      if (c.updated.includes(id) && this.session) this.refreshHeader();
      if (c.removed.includes(id)) ctx.router.go({ kind: "month", month: monthOf(ride.day) });
    }));
  }

  dispose(): void {
    this.disposer.dispose();
  }

  private header: HTMLElement | null = null;

  private build(ride: ActivitySummary, streams: ActivityStreams, initialView: SampleRange | null): void {
    const { ctx } = this;
    const session = new DetailSession(ride, streams, ctx.prefs.get("xAxis"), initialView);
    this.session = session;
    const stats = new StatsPanel(ctx, session);
    const toolbar = new ChartToolbar(ctx, session);
    const charts = new ChartStack(ctx, session);
    const brush = new BrushStrip(session, ctx.i18n.t("detail.overview"));
    const sections = new SectionsTable(ctx, session);
    const zones = new ZonesPanel(ctx, session);
    const curve = new PowerCurvePanel(ctx, session);
    const map = streams.lat ? new TrackMap(ctx, session) : null;
    this.disposer.add(() => { stats.dispose(); toolbar.dispose(); charts.dispose(); brush.dispose(); sections.dispose(); zones.dispose(); curve.dispose(); map?.dispose(); });

    this.header = this.makeHeader(ride);
    replaceChildren(this.element,
      this.header,
      stats.tiles,
      h("div", { class: map ? "detail__main" : "detail__main detail__main--nomap" },
        map ? map.element : h("p", { class: "detail__nogps" }, ctx.i18n.t("detail.noGps")),
        h("div", { class: "detail__charts" }, toolbar.element, charts.element, brush.element)),
      sections.element,
      h("div", { class: "detail__analysis" }, zones.element, curve.element),
      h("div", { class: "detail__stats" }, h("h2", {}, ctx.i18n.t("detail.statistics")), stats.groups),
    );
    charts.build();

    // the address follows the zoom (no history entry per zoom step)
    this.disposer.add(session.on("view", (v) => {
      if (v.live) return;
      ctx.router.replace({ kind: "ride", id: ride.id, view: v.zoomed ? v.range : null });
    }));
    this.disposer.listen(document, "keydown", (e) => this.onKey(e, ride));
  }

  private makeHeader(ride: ActivitySummary): HTMLElement {
    const { ctx } = this;
    return detailHeader(ctx, ride, {
      rename: (title) => void ctx.rides.rename(ride.id, title),
      download: () => void this.download(ride),
      remove: () => void this.remove(ride),
    });
  }

  private refreshHeader(): void {
    const ride = this.ctx.rides.get(this.id);
    if (!ride || !this.header) return;
    const next = this.makeHeader(ride);
    this.header.replaceWith(next);
    this.header = next;
  }

  private async download(ride: ActivitySummary): Promise<void> {
    const file = await this.ctx.rides.file(ride.id);
    if (!file) return;
    const url = URL.createObjectURL(new Blob([file.bytes], { type: "application/octet-stream" }));
    const a = h("a", { href: url, download: file.fileName });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async remove(ride: ActivitySummary): Promise<void> {
    const { ctx } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const ok = await confirmDialog({
      title: t("detail.deleteQuestion", { title: rideTitle(ctx.i18n, ride) }),
      text: t("detail.deleteText"),
      confirm: t("action.deleteConfirm"),
      cancel: t("action.cancel"),
      danger: true,
    });
    if (!ok) return;
    const removed = await ctx.rides.remove(ride.id);
    if (removed) ctx.toasts.show(t("detail.deleted"), { label: t("action.undo"), run: () => void ctx.rides.add([removed]) }, 8000);
  }

  private onKey(e: KeyboardEvent, ride: ActivitySummary): void {
    if (isTyping(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = e.key === "PageUp" ? -1 : e.key === "PageDown" ? 1 : 0;
    if (step) {
      const target = this.ctx.rides.neighbour(ride.id, step);
      if (target) this.ctx.router.go({ kind: "ride", id: target.id, view: null });
      e.preventDefault();
    } else if (e.key === "Backspace" && this.session?.viewState.canZoomBack) {
      this.session.zoomBack("keyboard");
      e.preventDefault();
    } else if (e.key === "Escape" && this.session) {
      if (this.session.cursor.pinned !== null) this.session.unpin("keyboard");
      else this.session.resetZoom("keyboard");
    }
  }

  private skeleton(ride: ActivitySummary): HTMLElement {
    return h("div", { class: "detail-skeleton", "aria-busy": "true" },
      h("h1", {}, rideTitle(this.ctx.i18n, ride)),
      h("div", { class: "skeleton skeleton--tiles" }),
      h("div", { class: "skeleton skeleton--main" }));
  }

  private message(key: "detail.notFound" | "detail.loadError"): HTMLElement {
    return h("div", { class: "notice" }, h("p", {}, this.ctx.i18n.t(key)), h("a", { class: "button", href: "#/" }, this.ctx.i18n.t("action.back")));
  }
}
