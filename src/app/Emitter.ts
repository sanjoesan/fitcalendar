// Typed events. Only the owner emits (protected); everyone else subscribes and gets an unsubscribe function back.

export type Unsubscribe = () => void;

export class Emitter<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<(payload: never) => void>>();

  on<K extends keyof Events>(name: K, listener: (payload: Events[K]) => void): Unsubscribe {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(listener as (payload: never) => void);
    return () => set.delete(listener as (payload: never) => void);
  }

  protected emit<K extends keyof Events>(name: K, payload: Events[K]): void {
    for (const listener of [...(this.listeners.get(name) ?? [])]) (listener as (p: Events[K]) => void)(payload);
  }
}

/** Collects unsubscribe/cleanup functions of a view and runs them all on dispose. */
export class Disposer {
  private readonly cleanups: (() => void)[] = [];

  add(...cleanup: (() => void)[]): void {
    this.cleanups.push(...cleanup);
  }

  listen<K extends keyof WindowEventMap>(target: Window, type: K, fn: (e: WindowEventMap[K]) => void): void;
  listen<K extends keyof DocumentEventMap>(target: Document, type: K, fn: (e: DocumentEventMap[K]) => void): void;
  listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, fn: (e: HTMLElementEventMap[K]) => void): void;
  listen(target: EventTarget, type: string, fn: (e: never) => void): void {
    target.addEventListener(type, fn as EventListener);
    this.cleanups.push(() => target.removeEventListener(type, fn as EventListener));
  }

  dispose(): void {
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
  }
}
