// A small typed helper for building DOM: h("div", { class: "x", onclick: … }, child, …).

export type Child = Node | string | number | null | undefined | false;

type Handler<E extends Event = Event> = (event: E) => void;

export type Attrs = {
  class?: string | undefined;
  [name: `on${string}`]: Handler<never> | undefined;
  [name: string]: string | number | boolean | null | undefined | Handler<never>;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (name.startsWith("on") && typeof value === "function") {
      el.addEventListener(name.slice(2), value as EventListener);
    } else if (value === true) {
      el.setAttribute(name, "");
    } else {
      el.setAttribute(name, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: (Child | Child[])[]): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
}

/** Replaces all children. */
export function replaceChildren(parent: Element, ...children: (Child | Child[])[]): void {
  parent.replaceChildren();
  append(parent, children);
}

export function prefersReducedMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A CSS custom property's current value (for canvas-drawn charts and the map, which cannot use var()). */
export function cssVar(name: string, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}
