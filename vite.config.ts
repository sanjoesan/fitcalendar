import { defineConfig, type Plugin } from "vitest/config";

/** Only own code and OpenStreetMap's tiles; no other server is ever contacted. Added to the built page only
 *  (the dev server injects inline styles of its own). */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ");

function contentSecurityPolicy(): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: (html) =>
      html.replace("<meta charset=\"utf-8\" />", `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="strict-origin-when-cross-origin" />`),
  };
}

// GitHub Pages serves the app below /fitcalendar/.
export default defineConfig({
  base: "/fitcalendar/",
  plugins: [contentSecurityPolicy()],
  build: { target: "es2022", sourcemap: true },
  worker: { format: "es" },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
