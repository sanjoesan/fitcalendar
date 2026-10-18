// The controls above the profiles: x axis, which curves, smoothing, zoom back and whole ride.

import type { AppContext } from "../app/context";
import { Disposer } from "../app/Emitter";
import type { PreferenceValues, XAxis } from "../app/Preferences";
import { CHANNELS } from "../model/channels";
import { h, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { visibleChannels } from "../charts/ChartStack";
import type { DetailSession } from "./DetailSession";

export class ChartToolbar {
  readonly element = h("div", { class: "chart-toolbar" });
  private readonly disposer = new Disposer();

  constructor(private readonly ctx: AppContext, private readonly session: DetailSession) {
    this.disposer.add(
      session.on("view", () => this.render()),
      session.on("axis", () => this.render()),
      ctx.prefs.on("changed", (key) => { if (key === "channelShown" || key === "smoothing") this.render(); }),
    );
    this.render();
  }

  dispose(): void {
    this.disposer.dispose();
  }

  private render(): void {
    const { ctx, session } = this;
    const t = ctx.i18n.t.bind(ctx.i18n);
    const { prefs } = ctx;
    const visible = visibleChannels(ctx, session);
    const present = CHANNELS.filter((c) => session.streams.channels[c.key]);
    const state = session.viewState;
    const axisOption = (axis: XAxis, label: string) => h("button", {
      type: "button", role: "radio", class: "segmented__option", "aria-checked": String(session.axis === axis),
      disabled: axis === "distance" && !session.canUseDistance,
      onclick: () => { session.setAxis(axis); prefs.set("xAxis", axis); },
    }, label);
    const smoothingOption = (value: PreferenceValues["smoothing"], label: string) => h("button", {
      type: "button", role: "radio", class: "segmented__option", "aria-checked": String(prefs.get("smoothing") === value),
      onclick: () => prefs.set("smoothing", value),
    }, label);
    replaceChildren(this.element,
      h("div", { class: "chart-toolbar__row" },
        h("div", { class: "segmented segmented--small", role: "radiogroup", "aria-label": t("detail.axis") },
          axisOption("distance", t("detail.axisDistance")), axisOption("time", t("detail.axisTime"))),
        h("div", { class: "chip-toggles", role: "group", "aria-label": t("detail.channels") }, present.map((c) => {
          const on = visible.includes(c);
          const chip = h("button", {
            type: "button", class: "chip-toggle", "aria-pressed": String(on),
            disabled: on && visible.length === 1,
            onclick: () => prefs.set("channelShown", { ...prefs.get("channelShown"), [c.key]: !on }),
          }, h("span", { class: "chip-toggle__dot" }), t(c.labelKey));
          chip.style.setProperty("--chip-colour", `var(${c.colour})`);
          return chip;
        })),
      ),
      h("div", { class: "chart-toolbar__row" },
        h("div", { class: "segmented segmented--small", role: "radiogroup", "aria-label": t("detail.smoothing") },
          h("span", { class: "segmented__label" }, t("detail.smoothing")),
          smoothingOption(0, t("detail.smoothingOff")), smoothingOption(5, "5 s"), smoothingOption(30, "30 s")),
        h("span", { class: "chart-toolbar__hint" }, t("detail.hint")),
        h("div", { class: "chart-toolbar__zoom" },
          h("button", { class: "button button--quiet", type: "button", disabled: !state.canZoomBack, title: `${t("action.zoomBack")} (Backspace)`, onclick: () => session.zoomBack("toolbar") },
            icon("undo"), t("action.zoomBack")),
          h("button", { class: "button button--quiet", type: "button", disabled: !state.zoomed, title: `${t("action.resetZoom")} (Esc)`, onclick: () => session.resetZoom("toolbar") },
            icon("expand"), t("action.resetZoom"))),
      ),
    );
  }
}
