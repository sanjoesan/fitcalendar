// Tells canvas-drawn parts (profiles, power curve, map track) when the colours change: the user's theme choice or,
// on "automatic", the system's light/dark switch.

import type { Unsubscribe } from "../app/Emitter";
import type { Preferences } from "../app/Preferences";

export function onThemeChange(prefs: Preferences, run: () => void): Unsubscribe {
  const system = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => { if (prefs.get("theme") === "auto") run(); };
  system.addEventListener("change", onSystem);
  const offPrefs = prefs.on("changed", (key) => { if (key === "theme") run(); });
  return () => {
    system.removeEventListener("change", onSystem);
    offPrefs();
  };
}
