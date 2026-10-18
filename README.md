# FitCalendar

Your `.fit` rides in a calendar - and every ride in detail. Runs entirely in the browser: files are read locally and
stored in the browser's own database (IndexedDB). Nothing is uploaded; the only outside connection is the
OpenStreetMap tiles of the map.

**Live:** https://sanjoesan.github.io/fitcalendar/

## What it does

**Calendar**
- A month as weeks (Monday to Sunday) with the ISO week in front and the week's distance, time, climb, rides and TSS
  at the end; the month's totals below, with the change against the month before and the longest ride.
- Ride chips in the sport's colour; resting on one shows a preview (track and elevation sketch, key numbers).
- Import with the button, `I`, or by dropping files anywhere. Duplicates are recognised; files that are not
  activities, cut off or damaged are reported per file.
- Export: every original .fit file from a chosen day on as one ZIP ("Export FIT").
- Keyboard: arrows between days, `PgUp`/`PgDn` months, `T` today. On phones: an agenda per week, swipe for months.

**Ride detail**
- Map (OpenStreetMap) with the track plain or coloured by speed, elevation, gradient, heart rate or power.
- Profiles for elevation, speed, heart rate, power, cadence, gradient, temperature and L/R balance - all under one
  cursor: move along one profile and every profile and the map follow; hover the map and the profiles follow.
- Drag over a profile to zoom; every number on the page then belongs to that stretch (tiles, statistics, zones,
  power curve). Zoom back step by step, `Esc` for the whole ride, an overview strip to pan. Click to pin a point.
- Laps, splits (1/5/10 km) and detected climbs; pointing at a row outlines it, clicking zooms to it.
- Statistics like a bike computer's: moving/elapsed time, ascent/descent, min/max elevation, gradient, average and
  maximum speed, heart rate, power and cadence, Normalized Power, IF, TSS, work (kJ), best 20 minutes, W/kg,
  temperature, pedal metrics and training effect when the device wrote them. FTP, IF, TSS and W/kg only on rides
  with power, % of max HR only on rides with heart rate.
- Time in heart-rate zones (5) and power zones (7), the power curve and the best efforts (5 s … 60 min) - each
  effort can be shown on the ride.
- Rename, download the original file, delete (with undo), previous/next ride.

**Athlete profile**
- FTP, maximum / threshold / resting heart rate and weight with the day they apply from: every ride uses the values
  of its day. Only what you enter counts - the rider settings a device writes into .fit files are not read.
- Editable zone boundaries.

German and English; light and dark.

## Development

```sh
npm ci
npm run dev        # http://localhost:5173/fitcalendar/
npm test           # parser, model and calendar tests (also runs over local .fit files when present)
npm run build      # type check + production build into dist/
```

`tests/e2e/smoke.mjs` drives the built app in a local Chrome (`npx vite preview`, then
`node tests/e2e/smoke.mjs http://localhost:4173/fitcalendar/ <screenshot-dir> <fit files…>`).

Pushing to `main` builds, tests and deploys to GitHub Pages (`.github/workflows/pages.yml`).

## Structure

| Folder | Responsibility |
|---|---|
| `src/fit` | Reading FIT bytes (`FitDecoder`), the profile subset (`profile`), FIT → parsed activity (`readActivity`) |
| `src/model` | Domain types and pure functions: summaries, segment statistics, climb, power, zones, calendar, sections |
| `src/store` | IndexedDB, the ride repository and the athlete profile - the only owners of stored data |
| `src/import` | The import tray and window (files and folders laid down before importing), the import job (worker parsing, duplicates), drop zone and progress panel |
| `src/export` | The ZIP export window and a small ZIP writer |
| `src/calendar` | Month model, grid, agenda, totals, previews, month picker |
| `src/detail` | The detail screen and its `DetailSession` (cursor, pin, zoom, preview) with the panels that follow it |
| `src/charts` | uPlot profiles, the overview strip, x-axis projection, touch |
| `src/map` | Leaflet map, nearest-point index, colour ramp |
| `src/profile` | The athlete profile screen |
| `src/i18n` | Texts (`de.ts` defines the keys, `en.ts` must match) and number/date formatting |
| `src/ui`, `src/app` | DOM helpers, icons, dialogs, toasts; router, preferences, app frame |

The font is Lora (SIL Open Font License, `public/Lora-OFL.txt`). Map data © OpenStreetMap contributors.
