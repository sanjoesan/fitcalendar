// The app's icons as inline SVG (stroke = currentColor, so they take the text colour).

const PATHS = {
  bike: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 9h6l3.5 8M9 9l3 8h-6.5M12 5h3l1.5 4"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="m6 20 3.5-5 3 2V12l-3-2-3 3M12.5 10l2.5 2.5h4M12.5 17l1.5 3.5"/>',
  walk: '<circle cx="13" cy="4.5" r="1.8"/><path d="m9 21 2.5-7 2.5 2.5V21M11.5 14 12 9l-3 2v3M12 9l3 3h2.5"/>',
  swim: '<circle cx="16" cy="7" r="1.8"/><path d="M3 17c2 0 2-1.5 4.5-1.5S10 17 12 17s2.5-1.5 4.5-1.5S19 17 21 17M7 13l4-4 3 3"/>',
  activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  upload: '<path d="M12 16V4m0 0-4.5 4.5M12 4l4.5 4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
  chevronLeft: '<path d="m15 5-7 7 7 7"/>',
  chevronRight: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  download: '<path d="M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M4 20h16"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4v16a8 8 0 0 0 0-16Z" fill="currentColor"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mountain: '<path d="m3 19 6-10 4 6 2-3 6 7Z"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  logo: '<circle cx="17" cy="7" r="3" fill="currentColor" stroke="none"/><path d="M2 20c3-5 6-7 9-7s5 2 11 7"/><path d="M7 20V12M7 12c-1.2-1.6-1.2-4 0-6 1.2 2 1.2 4.4 0 6Z"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, className = "icon"): SVGSVGElement {
  const template = document.createElement("template");
  template.innerHTML = `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  return template.content.firstElementChild as SVGSVGElement;
}
