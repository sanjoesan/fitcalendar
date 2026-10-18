// The address in the hash: which screen is open. Back, forward and reload all land on the same screen.
//   #/2026-10           a month          #/ride/<id>?r=120-560   a ride, zoomed to samples 120…560
//   #/profile           the athlete profile

import { monthKey, today, monthOf, type YearMonth } from "../model/calendar";
import type { SampleRange } from "../model/types";
import { Emitter } from "./Emitter";

export type Route =
  | { readonly kind: "month"; readonly month: YearMonth }
  | { readonly kind: "ride"; readonly id: string; readonly view: SampleRange | null }
  | { readonly kind: "profile" };

export function parseRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "ride" && parts[1]) {
    const r = new URLSearchParams(query).get("r")?.match(/^(\d+)-(\d+)$/);
    return { kind: "ride", id: decodeURIComponent(parts[1]), view: r ? { from: Number(r[1]), to: Number(r[2]) } : null };
  }
  if (parts[0] === "profile") return { kind: "profile" };
  const m = parts[0]?.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return { kind: "month", month: { year: Number(m[1]), month: Number(m[2]) } };
  return { kind: "month", month: monthOf(today()) };
}

export function routeHref(route: Route): string {
  switch (route.kind) {
    case "month":
      return `#/${monthKey(route.month)}`;
    case "ride":
      return `#/ride/${encodeURIComponent(route.id)}${route.view ? `?r=${route.view.from}-${route.view.to}` : ""}`;
    case "profile":
      return "#/profile";
  }
}

/** Whether two routes show the same screen (a ride's zoom does not make it another screen). */
export function sameScreen(a: Route, b: Route): boolean {
  if (a.kind === "ride" && b.kind === "ride") return a.id === b.id;
  return routeHref(a) === routeHref(b);
}

export class Router extends Emitter<{ changed: Route }> {
  private current: Route;

  constructor() {
    super();
    this.current = parseRoute(location.hash);
    window.addEventListener("hashchange", () => {
      this.current = parseRoute(location.hash);
      this.emit("changed", this.current);
    });
  }

  get route(): Route {
    return this.current;
  }

  go(route: Route): void {
    const href = routeHref(route);
    if (location.hash === href) return;
    location.hash = href;
  }

  /** Changes the address without a new history entry and without re-rendering (zoom, axis). */
  replace(route: Route): void {
    this.current = route;
    history.replaceState(history.state, "", routeHref(route));
  }
}
