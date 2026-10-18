// Touch on a profile: a horizontal swipe scrubs the cursor, a tap pins, a long press then drag selects a stretch.
// Vertical movement is left to the page (touch-action: pan-y), so scrolling keeps working.

const DECIDE_PX = 8;
const LONG_PRESS_MS = 350;

export interface TouchHandlers {
  indexAt(clientX: number): number;
  scrub(index: number): void;
  tap(index: number): void;
  selecting(from: number, to: number): void;
  selected(from: number, to: number): void;
}

export function attachTouch(element: HTMLElement, handlers: TouchHandlers): () => void {
  type Mode = "undecided" | "scrub" | "select" | "scroll";
  let mode: Mode = "scroll";
  let start = { x: 0, y: 0, index: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;

  const down = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    mode = "undecided";
    start = { x: e.clientX, y: e.clientY, index: handlers.indexAt(e.clientX) };
    timer = setTimeout(() => {
      if (mode !== "undecided") return;
      mode = "select";
      navigator.vibrate?.(10);
      handlers.selecting(start.index, start.index);
    }, LONG_PRESS_MS);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerType !== "touch" || mode === "scroll") return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (mode === "undecided" && Math.hypot(dx, dy) > DECIDE_PX) {
      mode = Math.abs(dx) > Math.abs(dy) ? "scrub" : "scroll";
      if (timer) clearTimeout(timer);
    }
    if (mode === "scrub") handlers.scrub(handlers.indexAt(e.clientX));
    else if (mode === "select") handlers.selecting(start.index, handlers.indexAt(e.clientX));
  };
  const up = (e: PointerEvent) => {
    if (e.pointerType !== "touch") return;
    if (timer) clearTimeout(timer);
    if (mode === "undecided") handlers.tap(start.index);
    else if (mode === "select") handlers.selected(start.index, handlers.indexAt(e.clientX));
    mode = "scroll";
  };
  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move);
  element.addEventListener("pointerup", up);
  element.addEventListener("pointercancel", up);
  return () => {
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    element.removeEventListener("pointerup", up);
    element.removeEventListener("pointercancel", up);
  };
}
