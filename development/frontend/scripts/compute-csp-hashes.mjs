/**
 * compute-csp-hashes.mjs — Fenrir Ledger
 *
 * Computes SHA-256 hashes of all inline scripts at build time and writes
 * them to src/lib/csp-hashes.generated.ts. The generated file is imported
 * by csp-headers.ts to produce hash-based CSP headers that are identical
 * across requests, enabling Cloud CDN to cache HTML responses.
 *
 * Usage:
 *   node scripts/compute-csp-hashes.mjs
 *   (runs automatically via package.json "prebuild" hook)
 *
 * Inline scripts hashed:
 *   1. next-themes ThemeProvider — theme-detection script injected before hydration
 *   2. GA4 init — only when NEXT_PUBLIC_GA4_MEASUREMENT_ID is set
 *
 * If you change the ThemeProvider props in layout.tsx or the GA4 inline
 * script content, re-run this script (or `npm run build`) to update hashes.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, "..");

// ── Helpers ──────────────────────────────────────────────────────────────────

/** SHA-256 hash of content, returned as base64. */
function sha256B64(content) {
  return createHash("sha256").update(content).digest("base64");
}

/** Format a hash as a CSP directive value: 'sha256-<base64>'. */
function cspHash(content) {
  return `'sha256-${sha256B64(content)}'`;
}

// ── next-themes inline script ─────────────────────────────────────────────────

/**
 * Extracts the next-themes ThemeProvider inline script content.
 *
 * next-themes renders a <script dangerouslySetInnerHTML> during SSR to set
 * the theme class on <html> before React hydration, preventing flash. The
 * script content is: `(I.toString())(serialisedProps)` where I is the minified
 * theme-detection function and serialisedProps encode the ThemeProvider config.
 *
 * Props match layout.tsx ThemeProvider invocation exactly:
 *   attribute="class", storageKey="fenrir-theme", defaultTheme="system",
 *   themes={["light","dark"]}, enableSystem (true), enableColorScheme (true, default)
 */
function computeNextThemesScriptContent() {
  const src = readFileSync(
    resolve(root, "node_modules/next-themes/dist/index.js"),
    "utf-8"
  );

  // Extract arrow function I — it starts at 'var I=' and ends before 'var Q='
  const iStart = src.indexOf("var I=") + "var I=".length;
  const qStart = src.indexOf("var Q=");
  if (iStart <= "var I=".length - 1 || qStart === -1) {
    throw new Error(
      "[compute-csp-hashes] Could not locate function I in next-themes dist. " +
        "next-themes may have been updated — check node_modules/next-themes/dist/index.js."
    );
  }

  let iFnSrc = src.slice(iStart, qStart).trimEnd();
  // Remove trailing semicolon if present
  if (iFnSrc.endsWith(";")) iFnSrc = iFnSrc.slice(0, -1);

  // ThemeProvider props — must stay in sync with layout.tsx
  // Y component serialises: JSON.stringify([attribute, storageKey, defaultTheme,
  //   forcedTheme, themes, value, enableSystem, enableColorScheme]).slice(1,-1)
  const attribute = "class"; // attribute="class"
  const storageKey = "fenrir-theme"; // storageKey="fenrir-theme"
  const defaultTheme = "system"; // derived: enableSystem=true → default "system"
  const forcedTheme = undefined; // not passed
  const themes = ["light", "dark"]; // themes={["light","dark"]}
  const value = undefined; // not passed
  const enableSystem = true; // enableSystem (flag prop)
  const enableColorScheme = true; // default

  const args = JSON.stringify([
    attribute,
    storageKey,
    defaultTheme,
    forcedTheme,
    themes,
    value,
    enableSystem,
    enableColorScheme,
  ]).slice(1, -1);

  return `(${iFnSrc})(${args})`;
}

// ── GA4 inline init script ────────────────────────────────────────────────────

/**
 * Extracts the GA4 inline init script content from layout.tsx source.
 *
 * Reads layout.tsx at build time and extracts the exact template literal
 * used as children of the <Script id="ga4-init"> element, then substitutes
 * the measurement ID. This ensures the hash stays in sync with layout.tsx —
 * any whitespace/content change to the script also changes the hash.
 *
 * Returns null if NEXT_PUBLIC_GA4_MEASUREMENT_ID is not set (script won't render).
 */
function computeGa4ScriptContent(measurementId) {
  if (!measurementId) return null;

  const layoutSrc = readFileSync(
    resolve(root, "src/app/layout.tsx"),
    "utf-8"
  );

  // Capture template literal content inside <Script id="ga4-init" ...>{`...`}</Script>
  const match = layoutSrc.match(
    /id="ga4-init"[\s\S]*?>\s*\{`([\s\S]*?)`\}\s*<\/Script>/
  );
  if (!match) {
    throw new Error(
      "[compute-csp-hashes] Could not find <Script id=\"ga4-init\"> in layout.tsx. " +
        "Update this script if the GA4 inline script was moved or renamed."
    );
  }

  // Substitute measurement ID placeholder
  return match[1].replace(
    /\$\{process\.env\.NEXT_PUBLIC_GA4_MEASUREMENT_ID\}/g,
    measurementId
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const nextThemesContent = computeNextThemesScriptContent();
const nextThemesHash = cspHash(nextThemesContent);

const ga4MeasurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || null;
const ga4Content = computeGa4ScriptContent(ga4MeasurementId);
const ga4Hash = ga4Content ? cspHash(ga4Content) : null;

const generated = `/**
 * CSP Inline Script Hashes — Auto-generated by scripts/compute-csp-hashes.mjs
 *
 * Re-generate: node scripts/compute-csp-hashes.mjs
 * Auto-runs:   npm run build  (via prebuild hook)
 * Auto-runs:   npm run dev    (via predev hook)
 *
 * DO NOT EDIT MANUALLY.
 */

/** SHA-256 hash of the next-themes ThemeProvider inline theme-detection script. */
export const NEXT_THEMES_SCRIPT_HASH = ${JSON.stringify(nextThemesHash)};

/**
 * SHA-256 hash of the GA4 inline init script.
 * null when NEXT_PUBLIC_GA4_MEASUREMENT_ID is not set (script will not render).
 */
export const GA4_INIT_SCRIPT_HASH: string | null = ${JSON.stringify(ga4Hash)};

/** All inline script hashes to include in script-src CSP directive. */
export const INLINE_SCRIPT_HASHES: string[] = [
  NEXT_THEMES_SCRIPT_HASH,
  ...(GA4_INIT_SCRIPT_HASH ? [GA4_INIT_SCRIPT_HASH] : []),
];
`;

const outPath = resolve(root, "src/lib/csp-hashes.generated.ts");
writeFileSync(outPath, generated);

console.log(`[compute-csp-hashes] next-themes: ${nextThemesHash}`);
if (ga4Hash) {
  console.log(`[compute-csp-hashes] GA4 init:     ${ga4Hash}`);
} else {
  console.log(
    "[compute-csp-hashes] GA4 init:     skipped (NEXT_PUBLIC_GA4_MEASUREMENT_ID not set)"
  );
}
console.log(`[compute-csp-hashes] written: src/lib/csp-hashes.generated.ts`);
