#!/usr/bin/env node
/**
 * collect-browser-coverage.mjs
 *
 * Converts Istanbul browser coverage JSON (from window.__coverage__)
 * into LCOV format for merging with Vitest coverage.
 *
 * Usage:
 *   node quality/scripts/collect-browser-coverage.mjs --input <coverage.json> --output <dir>
 *
 * Input: JSON file containing window.__coverage__ data (written by Playwright global teardown)
 * Output: LCOV + HTML reports in the specified directory
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createCoverageMap } from "istanbul-lib-coverage";
import { createContext } from "istanbul-lib-report";
import reports from "istanbul-reports";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const args = process.argv.slice(2);
const inputIdx = args.indexOf("--input");
const outputIdx = args.indexOf("--output");

const inputFile = inputIdx >= 0 ? args[inputIdx + 1] : path.join(REPO_ROOT, "quality/.coverage-tmp/browser-coverage.json");
const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : path.join(REPO_ROOT, "quality/reports/coverage/playwright");

if (!existsSync(inputFile)) {
  console.log(`No browser coverage data found at ${inputFile} — skipping`);
  process.exit(0);
}

console.log(`Processing browser coverage from ${inputFile}...`);

const coverageData = JSON.parse(readFileSync(inputFile, "utf-8"));
const coverageMap = createCoverageMap(coverageData);

mkdirSync(outputDir, { recursive: true });

const context = createContext({
  dir: outputDir,
  coverageMap,
  defaultSummarizer: "nested",
  watermarks: {
    statements: [50, 80],
    functions: [50, 80],
    branches: [50, 80],
    lines: [50, 80],
  },
});

// Generate reports
const htmlReport = reports.create("html");
const lcovReport = reports.create("lcovonly");
const textReport = reports.create("text-summary");

htmlReport.execute(context);
lcovReport.execute(context);
textReport.execute(context);

console.log(`Browser coverage reports written to ${outputDir}`);
console.log(`  - HTML: ${outputDir}/index.html`);
console.log(`  - LCOV: ${outputDir}/lcov.info`);
