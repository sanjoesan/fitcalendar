// Drives the built app in the local Chrome: imports .fit files, checks calendar, detail page, scrubbing and zoom,
// takes screenshots. Not part of `npm test` (needs Chrome, a running `vite preview` and local ride files).
//   node tests/e2e/smoke.mjs <base-url> <screenshot-dir> <fit-file> [<fit-file> …]

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const [base, outDir, ...files] = process.argv.slice(2);
if (!base || !outDir || files.length === 0) {
  console.error("usage: node tests/e2e/smoke.mjs <base-url> <screenshot-dir> <fit-file>…");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const CHROME = process.env.CHROME ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "GREEN" : "RED  "} ${name}${detail ? ` - ${detail}` : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "de-AT", colorScheme: "light" });
const page = await context.newPage();
const problems = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") problems.push(`${m.type()}: ${m.text()}`); });
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));

try {
await page.goto(base);
await page.waitForSelector(".month-grid");
check("calendar renders (empty)", (await page.locator(".empty-state").count()) === 1);
await page.screenshot({ path: join(outDir, "01-empty.png") });

await page.locator('input[type="file"]').setInputFiles(files);
await page.waitForFunction((n) => {
  const rows = document.querySelectorAll(".import-row");
  return rows.length === n && [...rows].every((r) => !r.classList.contains("import-row--waiting") && !r.classList.contains("import-row--parsing"));
}, files.length, { timeout: 120_000 });
const added = await page.locator(".import-row--added").count();
const failed = await page.locator(".import-row--error").count();
check("import", added > 0, `${added} added, ${failed} errors of ${files.length}`);
await page.screenshot({ path: join(outDir, "02-imported.png") });

// open the month of the newest ride: the import panel links to it
const lastMonthHref = await page.locator(".import-panel__day").last().getAttribute("href");
await page.goto(base + lastMonthHref);
await page.waitForSelector(".chip");
await page.waitForTimeout(300);
const chips = await page.locator(".chip").count();
check("calendar shows rides", chips > 0, `${chips} chips`);
check("week totals", (await page.locator(".week__totals:not(.week__totals--empty)").count()) > 0);
check("month totals", (await page.locator(".month-summary .figure").count()) > 0);
await page.locator(".chip").first().hover();
await page.waitForTimeout(500);
check("ride preview on hover", await page.locator(".preview").isVisible());
await page.screenshot({ path: join(outDir, "03-calendar.png"), fullPage: true });

// the longest ride of the month (the import panel closed first: it would lie over the profiles)
await page.locator(".import-panel__head .icon-button").click();
await page.locator(".figure__link").click();
await page.waitForSelector(".pane__plot canvas", { timeout: 20_000 });
await page.waitForTimeout(800);
const panes = await page.locator(".pane").count();
check("detail: profiles", panes > 0, `${panes} panes`);
check("detail: tiles", (await page.locator(".tile").count()) >= 4);
check("detail: statistics groups", (await page.locator(".stat-group").count()) >= 3);
const hasMap = (await page.locator(".map").count()) === 1;
await page.screenshot({ path: join(outDir, "04-detail.png"), fullPage: true });

// scrub: hover the first pane at 40 %
const over = page.locator(".pane .u-over").first();
const box = await over.boundingBox();
await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2);
await page.waitForTimeout(250);
const label = await page.locator(".charts__cursor").textContent();
check("scrub: position label", !!label && !(await page.locator(".charts__cursor").isHidden()), label ?? "");
const values = await page.locator(".pane__value").allTextContents();
check("scrub: live values", values.every((v) => v && !v.startsWith("Ø")), values.join(" | "));
if (hasMap) check("scrub: map marker", (await page.locator(".map__cursor-label").count()) === 1, await page.locator(".map__cursor-label").textContent() ?? "");
await page.screenshot({ path: join(outDir, "05-scrub.png") });

// drag-zoom from 30 % to 60 % (measured again: a full-page screenshot re-lays the page out)
const dragBox = await over.boundingBox();
Object.assign(box, dragBox);
await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.45, box.y + box.height / 2, { steps: 5 });
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(500);
check("zoom: section chip", await page.locator(".section-chip").isVisible(), await page.locator(".section-chip").textContent() ?? "");
check("zoom: address has range", /\?r=\d+-\d+/.test(page.url()), page.url());
const [, rFrom, rTo] = page.url().match(/\?r=(\d+)-(\d+)/) ?? [];
check("zoom: range is the dragged 30-60 %", Number(rTo) / Number(rFrom) > 1.6 && Number(rTo) / Number(rFrom) < 2.4, `${rFrom}-${rTo}`);
check("zoom: whole values shown", (await page.locator(".tile__whole").count()) > 0);
await page.screenshot({ path: join(outDir, "06-zoomed.png"), fullPage: true });
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Esc resets zoom", (await page.locator(".section-chip:not(.section-chip--idle)").count()) === 0);

// sections tab, power curve, zones
check("sections table", (await page.locator(".sections").count()) === 1);
check("zones panel", (await page.locator(".zone-card").count()) > 0);
const hasPower = (await page.locator(".power-curve:not([hidden])").count()) === 1;
if (hasPower) check("power curve", (await page.locator(".power-curve canvas").count()) > 0);
// enter FTP right in the zone card
const ask = page.locator(".zone-card--ask input").first();
if (await ask.count()) {
  await ask.fill("230");
  await page.locator(".zone-card--ask button[type=submit]").first().click();
  await page.waitForTimeout(400);
  check("FTP from zone card", (await page.locator(".zone-row").count()) > 0);
}
await page.screenshot({ path: join(outDir, "07-zones.png"), fullPage: true });

// axis switch keeps working
await page.getByRole("radio", { name: "Zeit" }).first().click();
await page.waitForTimeout(400);
check("time axis", (await page.locator(".pane__plot canvas").count()) > 0);

// dark mode
await page.emulateMedia({ colorScheme: "dark" });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, "08-detail-dark.png"), fullPage: true });

// profile
await page.goto(base + "#/profile");
await page.waitForSelector(".profile-form");
await page.waitForTimeout(400); // the screen change cross-fades
check("profile page", (await page.locator(".profile-form__fields .field").count()) === 5);
check("profile suggestions", (await page.locator(".suggestion").count()) > 0);
await page.emulateMedia({ colorScheme: "light" });
await page.screenshot({ path: join(outDir, "09-profile.png"), fullPage: true });

// phone
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(base + lastMonthHref);
await page.waitForSelector(".agenda");
check("phone: agenda", (await page.locator(".agenda-week").count()) > 0);
await page.screenshot({ path: join(outDir, "10-phone-calendar.png"), fullPage: true });
await page.locator(".agenda-ride").first().click();
await page.waitForSelector(".pane__plot canvas", { timeout: 20_000 });
await page.waitForTimeout(600);
await page.screenshot({ path: join(outDir, "11-phone-detail.png"), fullPage: true });
const overflow = await page.evaluate(() => {
  const width = document.documentElement.clientWidth;
  // the widest elements first: the cause, not the elements it pushed out
  const wide = [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > width + 1)
    .sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width)
    .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`).slice(0, 4);
  return { px: document.documentElement.scrollWidth - width, wide };
});
check("phone: no horizontal scroll", overflow.px <= 0, `${overflow.px}px ${overflow.wide.join(", ")}`);

// English
await page.setViewportSize({ width: 1440, height: 1000 });
await page.goto(base + lastMonthHref);
await page.getByRole("radio", { name: "EN" }).click();
await page.waitForTimeout(300);
check("English", (await page.locator(".month-grid__totalshead").textContent()) === "Week");
await page.screenshot({ path: join(outDir, "12-english.png") });

} catch (e) {
  check("run finished", false, e.message.split("\n")[0]);
  await page.screenshot({ path: join(outDir, "failure.png"), fullPage: true }).catch(() => {});
}

const relevant = problems.filter((p) => !/favicon/i.test(p));
check("no console errors / CSP violations", relevant.length === 0, relevant.slice(0, 5).join(" || "));
await browser.close();
const red = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - red} green, ${red} red`);
process.exit(red ? 1 : 0);
