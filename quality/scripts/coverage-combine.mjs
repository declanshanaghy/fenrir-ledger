#!/usr/bin/env node
/**
 * coverage-combine.mjs — Merge Vitest + Playwright coverage into a single report.
 *
 * Reads LCOV files from:
 *   quality/reports/coverage/vitest/lcov.info
 *   quality/reports/coverage/playwright/lcov.info
 *
 * Outputs combined report to:
 *   quality/reports/coverage/combined/  (HTML + LCOV + text-summary)
 *
 * Filters out .next/ compiled artifacts and node_modules so genhtml only
 * sees src/ source files.
 *
 * Custom CSS: if quality/scripts/coverage.css exists it is passed to genhtml
 * via --css-file to style the HTML report.
 *
 * Overwrites previous combined report on every run.
 *
 * Usage:
 *   node quality/scripts/coverage-combine.mjs
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const COVERAGE_DIR = path.join(REPO_ROOT, "quality/reports/coverage");
const COMBINED_DIR = path.join(COVERAGE_DIR, "combined");
const CUSTOM_CSS = path.join(__dirname, "coverage.css");

const SOURCES = [
  { name: "vitest", lcov: path.join(COVERAGE_DIR, "vitest/lcov.info") },
  { name: "playwright", lcov: path.join(COVERAGE_DIR, "playwright/lcov.info") },
];

// LCOV entries (SF: ... end_of_record) to exclude from the combined report.
// Playwright source maps produce both .next/ compiled artifacts and src/ entries
// for the same code — keep only src/. node_modules slips through source map
// resolution occasionally.
const EXCLUDE_PREFIXES = [
  ".next/",
  "node_modules/",
  "src/__tests__/",
];

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

/**
 * Filter out LCOV records whose SF: path starts with any of EXCLUDE_PREFIXES.
 * Returns cleaned LCOV string and a count of dropped records.
 */
function filterLcov(lcov) {
  const records = lcov.split("end_of_record");
  let kept = 0, dropped = 0;
  const filtered = records.filter((rec) => {
    const sf = rec.match(/^SF:(.+)$/m)?.[1]?.trim();
    if (!sf) return false; // empty trailing chunk
    const exclude = EXCLUDE_PREFIXES.some((p) => sf.startsWith(p));
    if (exclude) { dropped++; return false; }
    kept++;
    return true;
  });
  return { lcov: filtered.map((r) => r + "end_of_record").join("\n"), kept, dropped };
}

export { filterLcov, EXCLUDE_PREFIXES };

function main() {
  log("Combining coverage reports...");

  const available = SOURCES.filter((s) => existsSync(s.lcov));
  if (available.length === 0) {
    log("ERROR: No coverage data found. Run pnpm run verify:unit or verify:e2e with --coverage first.");
    log(`  Looked for: ${SOURCES.map((s) => s.lcov).join(", ")}`);
    process.exit(1);
  }

  log(`Found coverage from: ${available.map((s) => s.name).join(", ")}`);

  if (existsSync(COMBINED_DIR)) rmSync(COMBINED_DIR, { recursive: true });
  mkdirSync(COMBINED_DIR, { recursive: true });

  // Merge then filter
  const raw = available.map((s) => readFileSync(s.lcov, "utf-8")).join("\n");
  const { lcov: filtered, kept, dropped } = filterLcov(raw);
  log(`LCOV filtered: ${kept} records kept, ${dropped} dropped (.next/ + node_modules)`);

  const mergedLcovPath = path.join(COMBINED_DIR, "lcov.info");
  writeFileSync(mergedLcovPath, filtered);
  log(`Merged LCOV written to ${mergedLcovPath}`);

  // Build genhtml command
  const frontendDir = path.join(REPO_ROOT, "development/frontend");
  const cssFlag = existsSync(CUSTOM_CSS) ? `--css-file "${CUSTOM_CSS}"` : "";
  if (cssFlag) log(`Custom CSS: ${path.relative(REPO_ROOT, CUSTOM_CSS)}`);

  const genHtmlCmd = [
    `genhtml "${mergedLcovPath}"`,
    `--output-directory "${COMBINED_DIR}"`,
    "--quiet",
    "--flat", // no directory hierarchy — prevents misleading directory-level aggregation
    // genhtml 2.3.x requires each error type twice to fully suppress (promote from fatal → ignored)
    "--ignore-errors inconsistent,inconsistent,corrupt,corrupt,source,source,count,count,category,category",
    "--keep-going",
    "--synthesize-missing",
    "--rc max_message_count=0",
    cssFlag,
  ].filter(Boolean).join(" ");

  try {
    execSync(genHtmlCmd, { stdio: ["pipe", "pipe", "pipe"], cwd: frontendDir });
    log("HTML report generated via genhtml");
  } catch (err) {
    if (existsSync(path.join(COMBINED_DIR, "index.html"))) {
      log("HTML report generated via genhtml (with warnings)");
    } else {
      const stderr = err.stderr?.toString() || "";
      log(`genhtml failed — text summary only${stderr ? `: ${stderr.split("\n")[0]}` : ""}`);
      generateTextSummary(filtered);
    }
  }

  generateTextSummary(filtered);

  log("");
  log("Coverage reports:");
  for (const s of available) {
    log(`  ${s.name}: quality/reports/coverage/${s.name}/index.html`);
  }
  log(`  combined: quality/reports/coverage/combined/index.html`);
  log(`  combined LCOV: quality/reports/coverage/combined/lcov.info`);
  log("");
  log("Done!");
}

function generateTextSummary(lcovContent) {
  let linesHit = 0, linesTotal = 0;
  let fnHit = 0, fnTotal = 0;
  let brHit = 0, brTotal = 0;

  for (const line of lcovContent.split("\n")) {
    if (line.startsWith("LH:")) linesHit += parseInt(line.slice(3), 10);
    if (line.startsWith("LF:")) linesTotal += parseInt(line.slice(3), 10);
    if (line.startsWith("FNH:")) fnHit += parseInt(line.slice(4), 10);
    if (line.startsWith("FNF:")) fnTotal += parseInt(line.slice(4), 10);
    if (line.startsWith("BRH:")) brHit += parseInt(line.slice(4), 10);
    if (line.startsWith("BRF:")) brTotal += parseInt(line.slice(4), 10);
  }

  const pct = (hit, total) => total > 0 ? ((hit / total) * 100).toFixed(1) : "0.0";
  const files = (lcovContent.match(/^SF:/gm) || []).length;

  console.log("");
  console.log("=============================== Combined Coverage ===============================");
  console.log(`Files        : ${files}`);
  console.log(`Lines        : ${pct(linesHit, linesTotal)}% ( ${linesHit}/${linesTotal} )`);
  console.log(`Functions    : ${pct(fnHit, fnTotal)}% ( ${fnHit}/${fnTotal} )`);
  console.log(`Branches     : ${pct(brHit, brTotal)}% ( ${brHit}/${brTotal} )`);
  console.log("================================================================================");
}

// Only run when executed directly (not imported for testing)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
