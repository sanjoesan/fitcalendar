// The frame around the screens: top bar, drop zone, import panel, toasts - and switching screens on route changes.

import { CalendarView } from "../calendar/CalendarView";
import { DetailView } from "../detail/DetailView";
import { DropZone } from "../import/DropZone";
import { ImportPanel } from "../import/ImportPanel";
import { ProfileView } from "../profile/ProfileView";
import { h, prefersReducedMotion, replaceChildren } from "../ui/dom";
import { icon } from "../ui/icons";
import { languageSwitch, themeSwitch } from "../ui/settingsControls";
import { routeHref, sameScreen, type Route } from "./Router";
import type { AppContext, View } from "./context";
import { Disposer } from "./Emitter";

export class App {
  private readonly main = h("main", { class: "main", id: "main" });
  private readonly toolbarSlot = h("div", { class: "topbar__context" });
  private readonly navSlot = h("nav", { class: "topbar__nav" });
  private readonly actionsSlot = h("div", { class: "topbar__actions" });
  private readonly fileInput = h("input", { type: "file", accept: ".fit,.FIT", multiple: true, hidden: true });
  private view: View | null = null;
  private shownRoute: Route | null = null;
  private readonly disposer = new Disposer();

  constructor(private readonly root: HTMLElement, private readonly ctx: AppContext) {}

  start(): void {
    const { ctx } = this;
    this.fileInput.addEventListener("change", () => {
      ctx.importJob.add([...(this.fileInput.files ?? [])]);
      this.fileInput.value = "";
    });
    const dropZone = new DropZone(ctx, (files) => ctx.importJob.add(files));
    const panel = new ImportPanel(ctx);
    replaceChildren(this.root,
      h("header", { class: "topbar" },
        h("a", { class: "brand", href: "#/" },
          icon("logo", "brand__mark"), h("span", { class: "brand__name" }, ctx.i18n.t("app.name"))),
        this.navSlot,
        this.toolbarSlot,
        this.actionsSlot,
      ),
      this.main,
      dropZone.element,
      panel.element,
      ctx.toasts.element,
      this.fileInput,
    );
    this.renderChrome();
    this.disposer.add(
      ctx.router.on("changed", (route) => this.show(route)),
      ctx.i18n.on("change", () => { this.renderChrome(); this.show(ctx.router.route, true); }),
      ctx.prefs.on("changed", (key) => { if (key === "theme") { this.applyTheme(); this.renderChrome(); } }),
    );
    this.applyTheme();
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "i" && !isTyping(e) && !e.ctrlKey && !e.metaKey && !e.altKey) this.openPicker();
    });
    this.show(ctx.router.route);
  }

  openPicker(): void {
    this.fileInput.click();
  }

  private show(route: Route, force = false): void {
    if (!force && this.shownRoute && sameScreen(this.shownRoute, route)) return;
    const swap = () => {
      this.view?.dispose();
      this.view = this.createView(route);
      this.shownRoute = route;
      replaceChildren(this.main, this.view.element);
      replaceChildren(this.toolbarSlot, this.view.toolbar ?? null);
      this.renderNav(route);
      window.scrollTo({ top: 0 });
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } };
    if (doc.startViewTransition && !prefersReducedMotion() && this.view) {
      // A quick second navigation skips the running transition; that is fine, not an error.
      doc.startViewTransition(swap).ready.catch(() => {});
    } else swap();
  }

  private createView(route: Route): View {
    switch (route.kind) {
      case "month":
        return new CalendarView(this.ctx, route.month, () => this.openPicker());
      case "ride":
        return new DetailView(this.ctx, route.id, route.view);
      case "profile":
        return new ProfileView(this.ctx);
    }
  }

  private renderNav(route: Route): void {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    const link = (href: string, label: string, iconName: "calendar" | "user", active: boolean) =>
      h("a", { class: active ? "nav-link nav-link--active" : "nav-link", href, "aria-current": active ? "page" : undefined },
        icon(iconName), h("span", { class: "nav-link__label" }, label));
    const month = route.kind === "month" ? route.month : null;
    replaceChildren(this.navSlot,
      link(month ? routeHref({ kind: "month", month }) : "#/", t("nav.calendar"), "calendar", route.kind !== "profile"),
      link("#/profile", t("nav.profile"), "user", route.kind === "profile"),
    );
  }

  /** Import button, language and theme switches. */
  private renderChrome(): void {
    const t = this.ctx.i18n.t.bind(this.ctx.i18n);
    replaceChildren(this.actionsSlot,
      h("button", { class: "button button--primary import-button", type: "button", title: `${t("action.import")} (I)`, onclick: () => this.openPicker() },
        icon("upload"), h("span", { class: "import-button__label" }, t("action.import"))),
      languageSwitch(this.ctx),
      themeSwitch(this.ctx, () => {}),
    );
  }

  private applyTheme(): void {
    const theme = this.ctx.prefs.get("theme");
    if (theme === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
  }
}

export function isTyping(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  return !!target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}
