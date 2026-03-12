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

const SOURCES = [
  { name: "vitest", lcov: path.join(COVERAGE_DIR, "vitest/lcov.info") },
  { name: "playwright", lcov: path.join(COVERAGE_DIR, "playwright/lcov.info") },
];

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function main() {
  log("Combining coverage reports...");

  // Check which sources exist
  const available = SOURCES.filter((s) => existsSync(s.lcov));
  if (available.length === 0) {
    log("ERROR: No coverage data found. Run verify.sh --coverage first.");
    log(`  Looked for: ${SOURCES.map((s) => s.lcov).join(", ")}`);
    process.exit(1);
  }

  log(`Found coverage from: ${available.map((s) => s.name).join(", ")}`);

  // Clean and recreate combined output dir
  if (existsSync(COMBINED_DIR)) rmSync(COMBINED_DIR, { recursive: true });
  mkdirSync(COMBINED_DIR, { recursive: true });

  // Merge LCOV files (simple concatenation — lcov format supports this)
  const mergedLcov = available.map((s) => readFileSync(s.lcov, "utf-8")).join("\n");
  const mergedLcovPath = path.join(COMBINED_DIR, "lcov.info");
  writeFileSync(mergedLcovPath, mergedLcov);
  log(`Merged LCOV written to ${mergedLcovPath}`);

  // Generate HTML + text-summary from merged LCOV using genhtml (if available) or lcov-summary
  try {
    // Try genhtml (from lcov package) for HTML report
    execSync(
      `genhtml "${mergedLcovPath}" --output-directory "${COMBINED_DIR}" --quiet`,
      { stdio: "pipe" },
    );
    log("HTML report generated via genhtml");
  } catch {
    // Fall back: just report the LCOV stats manually
    log("genhtml not available — generating text summary only");
    generateTextSummary(mergedLcov);
  }

  // Always print a text summary
  generateTextSummary(mergedLcov);

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
  // Parse LCOV to extract line/function/branch counts
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

main();
