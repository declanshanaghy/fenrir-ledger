#!/usr/bin/env node
/**
 * coverage-index.mjs — Generate the master coverage index HTML page
 *
 * Scans quality/reports/coverage/ for sub-reports and creates an index
 * with links and summaries for each coverage type.
 *
 * Usage:
 *   node quality/scripts/coverage-index.mjs
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const REPORTS_DIR = path.join(REPO_ROOT, "quality/reports/coverage");

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function parseLcov(lcovPath) {
  if (!existsSync(lcovPath)) return null;

  const content = readFileSync(lcovPath, "utf-8");
  let lines = 0, linesHit = 0;
  let functions = 0, functionsHit = 0;
  let branches = 0, branchesHit = 0;

  const lines_total = content.match(/^end_of_record/m) ?
    content.split("\n").filter(l => l.startsWith("LF:")).length : 0;

  for (const line of content.split("\n")) {
    if (line.startsWith("LF:")) lines = parseInt(line.slice(3)) || 0;
    if (line.startsWith("LH:")) linesHit = parseInt(line.slice(3)) || 0;
    if (line.startsWith("FNF:")) functions = parseInt(line.slice(4)) || 0;
    if (line.startsWith("FNH:")) functionsHit = parseInt(line.slice(4)) || 0;
    if (line.startsWith("BRF:")) branches = parseInt(line.slice(4)) || 0;
    if (line.startsWith("BRH:")) branchesHit = parseInt(line.slice(4)) || 0;
  }

  return {
    lines: lines ? Math.round((linesHit / lines) * 100) : 0,
    functions: functions ? Math.round((functionsHit / functions) * 100) : 0,
    branches: branches ? Math.round((branchesHit / branches) * 100) : 0,
  };
}

function generateIndexHtml() {
  const vitest = parseLcov(path.join(REPORTS_DIR, "vitest/lcov.info"));
  const playwright = parseLcov(path.join(REPORTS_DIR, "playwright/lcov.info"));
  const combined = parseLcov(path.join(REPORTS_DIR, "combined/lcov.info"));

  // React = integration tests (component render tests)
  const react = vitest; // Same as vitest for now, but semantically "react tests"

  const hasVitest = existsSync(path.join(REPORTS_DIR, "vitest/index.html"));
  const hasPlaywright = existsSync(path.join(REPORTS_DIR, "playwright/index.html"));
  const hasCombined = existsSync(path.join(REPORTS_DIR, "combined/index.html"));

  const getCoverageColor = (percent) => {
    if (percent >= 80) return "#4ade80"; // green
    if (percent >= 60) return "#c9920a"; // gold (valheim)
    return "#ef4444"; // red
  };

  const renderCoverageBar = (percent) => {
    const color = getCoverageColor(percent);
    return `<div style="display: flex; align-items: center; gap: 1rem;">
      <div style="width: 200px; height: 24px; background: #0f0f16; border: 1px solid #8b8680; border-radius: 4px; overflow: hidden;">
        <div style="width: ${percent}%; height: 100%; background: linear-gradient(90deg, #c41e3a 0%, ${color} 100%);"></div>
      </div>
      <span style="color: ${color}; font-weight: 700; min-width: 50px;">${percent}%</span>
    </div>`;
  };

  const renderReport = (title, coverage, htmlPath, type) => {
    if (!coverage) return `<div class="report-card empty"><p>${title} — No data</p></div>`;

    return `<div class="report-card">
      <h3><a href="${htmlPath}">${title}</a></h3>
      <div class="coverage-grid">
        <div class="coverage-item">
          <label>Lines</label>
          ${renderCoverageBar(coverage.lines)}
        </div>
        <div class="coverage-item">
          <label>Functions</label>
          ${renderCoverageBar(coverage.functions)}
        </div>
        <div class="coverage-item">
          <label>Branches</label>
          ${renderCoverageBar(coverage.branches)}
        </div>
      </div>
      <p class="card-footer"><a href="${htmlPath}">View full ${type} report →</a></p>
    </div>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fenrir Ledger — Coverage Reports</title>
  <style>
    :root {
      --void-black: #07070d;
      --valheim-gold: #c9920a;
      --valheim-stone: #8b8680;
      --valheim-dirt: #6b5d4f;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    html, body {
      background-color: var(--void-black);
      color: #e8e8e0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.6;
    }

    body { padding: 2rem; }

    header {
      max-width: 1200px;
      margin: 0 auto 3rem;
      padding-bottom: 2rem;
      border-bottom: 3px solid var(--valheim-gold);
    }

    h1 {
      color: var(--valheim-gold);
      font-size: 2.5rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--valheim-stone);
      font-size: 1.1rem;
      font-style: italic;
    }

    .timestamp {
      color: var(--valheim-stone);
      font-size: 0.9rem;
      margin-top: 1rem;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    .reports-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .report-card {
      background-color: #0f0f16;
      border: 2px solid var(--valheim-stone);
      border-radius: 6px;
      padding: 1.5rem;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .report-card:hover {
      border-color: var(--valheim-gold);
      box-shadow: 0 0 20px rgba(201, 146, 10, 0.2);
    }

    .report-card.empty {
      background-color: #1a1a22;
      border-color: var(--valheim-stone);
      opacity: 0.6;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
    }

    .report-card h3 {
      color: var(--valheim-gold);
      margin-bottom: 1.5rem;
      font-size: 1.3rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .report-card h3 a {
      color: var(--valheim-gold);
      text-decoration: none;
      border-bottom: 2px dashed var(--valheim-gold);
      transition: all 0.2s;
    }

    .report-card h3 a:hover {
      border-bottom-style: solid;
      text-shadow: 0 0 10px rgba(201, 146, 10, 0.5);
    }

    .coverage-grid {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .coverage-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .coverage-item label {
      color: var(--valheim-gold);
      font-weight: 600;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .card-footer {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--valheim-dirt);
      text-align: center;
    }

    .card-footer a {
      color: var(--valheim-gold);
      text-decoration: none;
      font-weight: 600;
    }

    .card-footer a:hover {
      text-decoration: underline;
    }

    .legend {
      background-color: #0f0f16;
      border-left: 4px solid var(--valheim-gold);
      padding: 1.5rem;
      margin-bottom: 2rem;
      border-radius: 4px;
    }

    .legend h4 {
      color: var(--valheim-gold);
      margin-bottom: 1rem;
    }

    .legend p {
      margin-bottom: 0.5rem;
      color: var(--valheim-stone);
    }

    footer {
      text-align: center;
      color: var(--valheim-stone);
      padding-top: 2rem;
      border-top: 1px solid var(--valheim-dirt);
      margin-top: 3rem;
    }

    footer a {
      color: var(--valheim-gold);
      text-decoration: none;
    }
  </style>
</head>
<body>
  <header>
    <h1>⚔️ Fenrir Ledger — Coverage Reports</h1>
    <p class="subtitle">The wolf hunts. Every line must be accountable.</p>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
  </header>

  <div class="container">
    <div class="legend">
      <h4>Coverage Tiers</h4>
      <p>🟢 80%+ — The kill is clean. Tests guard the realm well.</p>
      <p>🟡 60-79% — Warning. Sharpen your blade. More tests needed.</p>
      <p>🔴 Below 60% — Blood spilled. Critical gaps in the shield wall.</p>
    </div>

    <div class="reports-grid">
      ${hasVitest ? renderReport(
        "Unit & Integration Tests",
        vitest,
        "vitest/index.html",
        "unit/integration"
      ) : '<div class="report-card empty"><p>Unit tests — No data</p></div>'}

      ${hasPlaywright ? renderReport(
        "E2E Tests (Playwright)",
        playwright,
        "playwright/index.html",
        "E2E"
      ) : '<div class="report-card empty"><p>E2E tests — No data</p></div>'}

      ${hasCombined ? renderReport(
        "Combined Coverage",
        combined,
        "combined/index.html",
        "combined"
      ) : '<div class="report-card empty"><p>Combined coverage — No data</p></div>'}
    </div>
  </div>

  <footer>
    <p>Coverage powered by <strong>Vitest</strong> + <strong>Playwright</strong> + <strong>c8</strong></p>
    <p><a href="https://github.com/declanshanaghy/fenrir-ledger">Fenrir Ledger</a> — Norse mythology meets credit card hunting.</p>
  </footer>
</body>
</html>`;

  writeFileSync(path.join(REPORTS_DIR, "index.html"), html, "utf-8");
  log(`Master index generated: quality/reports/coverage/index.html`);
}

try {
  generateIndexHtml();
  log("Done!");
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
