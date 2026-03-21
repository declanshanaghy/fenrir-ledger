#!/usr/bin/env node
/**
 * quality-report-html.mjs — Generate quality/reports/quality-report.html
 *
 * Full Fenrir-styled HTML quality report with embedded CSS, SVG seals,
 * and Norse war room aesthetic. This is the primary report artifact.
 *
 * Usage:
 *   node quality/scripts/quality-report-html.mjs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_TESTS = path.join(REPO_ROOT, "development/frontend/src/__tests__");
const E2E_TESTS = path.join(REPO_ROOT, "quality/test-suites");
const COVERAGE_DIR = path.join(REPO_ROOT, "quality/reports/coverage");
const OUTPUT_PATH = path.join(REPO_ROOT, "quality/reports/quality-report.html");

function ts() { return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z"); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

function walkDir(dir, exts, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkDir(full, exts, results);
    else if (exts.some(x => entry.name.endsWith(x))) results.push(full);
  }
  return results;
}

function countTests(content) {
  return (content.match(/^\s*(it|test)\s*\(/gm) || []).length;
}

function parseLcov(lcovPath) {
  if (!existsSync(lcovPath)) return null;
  const content = readFileSync(lcovPath, "utf-8");
  let lf = 0, lh = 0, fnf = 0, fnh = 0, brf = 0, brh = 0, files = 0;
  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) files++;
    if (line.startsWith("LF:")) lf += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith("LH:")) lh += parseInt(line.slice(3), 10) || 0;
    if (line.startsWith("FNF:")) fnf += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("FNH:")) fnh += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("BRF:")) brf += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("BRH:")) brh += parseInt(line.slice(4), 10) || 0;
  }
  const pct = (hit, total) => total > 0 ? ((hit / total) * 100).toFixed(1) : "0.0";
  return { files, lines: { pct: pct(lh, lf), hit: lh, total: lf }, functions: { pct: pct(fnh, fnf), hit: fnh, total: fnf }, branches: { pct: pct(brh, brf), hit: brh, total: brf } };
}

function categorise(filePath) {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
  const name = path.basename(filePath);
  if (rel.includes("quality/test-suites")) return "e2e";
  if (name.endsWith(".tsx")) return "component";
  const seg = (d) => rel.includes(`/__tests__/${d}/`) || rel.includes(`/__tests__/${d}`);
  if (seg("hooks")) return "hook";
  if (seg("components") || seg("karl-bling") || seg("pages") || seg("layout")) return "component";
  if (seg("integration") || seg("admin") || seg("api") || seg("auth") || seg("sync") || seg("stripe") || seg("trial") || seg("household") || seg("health") || name.includes(".integration.")) return "api";
  return "unit";
}

const BULLSHIT_CHECKS = [
  { id: "vacuous", label: "Vacuous Assertions", detect: (c) => /expect\(\s*true\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*true\s*\)/.test(c) },
  { id: "infra-yaml", label: "Infrastructure YAML", detect: (c) => /readFileSync/.test(c) && /(\.yaml|\.yml|helm|pdb|deployment|values|Chart)/.test(c) },
  { id: "css-string", label: "CSS String Assertions", detect: (c) => /readFileSync/.test(c) && /\.css['"`]/.test(c) && /(expect\(css\)|toContain|toMatch)/.test(c) },
  { id: "source-assert", label: "Source File Content", detect: (c) => /readFileSync/.test(c) && /\.(ts|tsx|js|mjs)['"`]/.test(c) && /(toContain|toMatch|includes)/.test(c) },
  { id: "static-copy", label: "Static Page Copy", detect: (c, fp) => { const n = path.basename(fp); return (n.includes("section-order") || n.includes("features-section") || n.includes("marketing-nav")) && /(getByText|getAllByText|toContain|screen\.get)/.test(c); } },
];

function detectBullshit(fp, content) {
  return BULLSHIT_CHECKS.filter(({ detect }) => detect(content, fp)).map(({ id, label }) => ({ id, label }));
}

// ── Coverage gauge SVG ────────────────────────────────────────────────────────

function gaugeRing(pct, label, size = 100) {
  const n = parseFloat(pct);
  const r = (size - 10) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (n / 100) * circumference;
  const color = n >= 80 ? "#4ade80" : n >= 60 ? "#c9920a" : "#ef4444";
  return `<svg width="${size}" height="${size + 24}" viewBox="0 0 ${size} ${size + 24}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#2a2a34" stroke-width="8"/>
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
      stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
      stroke-linecap="round" transform="rotate(-90 ${c} ${c})"
      style="transition: stroke-dashoffset 1s ease"/>
    <text x="${c}" y="${c + 5}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="18" font-weight="700" fill="${color}">${pct}%</text>
    <text x="${c}" y="${size + 18}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8b8680">${label}</text>
  </svg>`;
}

// ── Loki signature SVG ────────────────────────────────────────────────────────

function lokiSealSvg(dateStr, isSecure) {
  const glowColor = isSecure ? "#4ade80" : "#ef4444";
  const runeGlow = isSecure ? "drop-shadow(0 0 6px #4ade8060)" : "drop-shadow(0 0 6px #ef444460)";
  return `<svg width="320" height="160" viewBox="0 0 320 160" xmlns="http://www.w3.org/2000/svg" style="background:#0b1f14;border-radius:8px">
    <defs>
      <linearGradient id="seal-border" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#2d6b4a"/>
        <stop offset="35%" stop-color="#4a9e6e"/>
        <stop offset="50%" stop-color="#7ecfa0"/>
        <stop offset="65%" stop-color="#4a9e6e"/>
        <stop offset="100%" stop-color="#2d6b4a"/>
      </linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="metallic-sheen" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#1e4d32" stop-opacity="0.5"/>
        <stop offset="30%" stop-color="#133322" stop-opacity="0.15"/>
        <stop offset="60%" stop-color="#1e4d32" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="#0e2a1a" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="320" height="160" rx="8" fill="#0b1f14"/>
    <rect x="0" y="0" width="320" height="160" rx="8" fill="url(#metallic-sheen)"/>
    <rect x="2" y="2" width="316" height="156" rx="8" fill="none" stroke="url(#seal-border)" stroke-width="1.5"/>
    <rect x="5" y="5" width="310" height="150" rx="6" fill="none" stroke="#c9920a" stroke-width="0.3" opacity="0.2"/>
    <line x1="30" y1="42" x2="290" y2="42" stroke="#c9920a" stroke-width="0.4" opacity="0.2"/>
    <text x="160" y="32" text-anchor="middle" font-family="serif" font-size="20" letter-spacing="10" fill="#c9920a" opacity="0.8" filter="url(#glow)">ᛚ ᛟ ᚲ ᛁ</text>
    <text x="160" y="64" text-anchor="middle" font-family="serif" font-size="14" fill="#c9920a" opacity="0.9" letter-spacing="2">Loki Laufeyson</text>
    <text x="160" y="84" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8b8680">QA Tester</text>
    <text x="160" y="104" text-anchor="middle" font-family="monospace" font-size="10" fill="#666">${dateStr}</text>
    <line x1="30" y1="115" x2="290" y2="115" stroke="#c9920a" stroke-width="0.3" opacity="0.15"/>
    <text x="160" y="138" text-anchor="middle" font-family="serif" font-size="12" letter-spacing="4" fill="${glowColor}" opacity="0.5" style="filter: ${runeGlow}">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</text>
    <text x="160" y="153" text-anchor="middle" font-family="sans-serif" font-size="7" fill="#555" letter-spacing="2">OFFICIAL SEAL</text>
  </svg>`;
}

// ── Overlap analysis ──────────────────────────────────────────────────────────

/**
 * Parse LCOV into per-file hit stats:
 *   { relPath → { lines, hit, totalHitCount } }
 */
function parseLcovPerFile(lcovPath, repoRoot) {
  if (!existsSync(lcovPath)) return {};
  const content = readFileSync(lcovPath, "utf-8");
  const result = {};
  let cur = null;
  for (const line of content.split("\n")) {
    if (line.startsWith("SF:")) {
      cur = line.slice(3).replace(repoRoot + "/", "").replace(repoRoot + path.sep, "");
      result[cur] = { lines: 0, hit: 0, totalHitCount: 0 };
    } else if (line.startsWith("DA:") && cur) {
      const parts = line.slice(3).split(",");
      if (parts.length >= 2) {
        result[cur].lines++;
        const count = parseInt(parts[1], 10) || 0;
        if (count > 0) { result[cur].hit++; result[cur].totalHitCount += count; }
      }
    }
  }
  return result;
}

/**
 * Find loki twin pairs: files where foo.loki.test.ts exists alongside foo.test.ts
 * Returns [{ base, loki, baseTests, lokiTests }]
 */
function findLokiTwins(testFiles) {
  const byRel = new Map(testFiles.map(f => [f.rel, f]));
  const twins = [];
  for (const [rel, f] of byRel) {
    if (!rel.includes(".loki.test.")) continue;
    const baseRel = rel.replace(".loki.test.", ".test.");
    if (byRel.has(baseRel)) {
      twins.push({ loki: rel, base: baseRel, lokiTests: f.tests, baseTests: byRel.get(baseRel).tests });
    }
  }
  return twins;
}

/**
 * Find clusters of test files that share the same base name modulo an issue number.
 * Pattern: name[-NNNN][-loki].test.ts — groups by normalised base (strip -NNNN, -loki).
 * Returns [{ base, files: [{ rel, tests }], totalTests }] for clusters with 3+ files.
 */
function findIssueClusters(testFiles) {
  const clusters = new Map();
  for (const f of testFiles) {
    const name = path.basename(f.rel)
      .replace(/\.(loki\.test|test|spec)\.(tsx?|jsx?)$/, "");
    // strip trailing -NNNN and -loki suffixes to get the canonical base
    const base = name.replace(/-loki$/, "").replace(/-\d+(-loki)?$/, "");
    if (base === name) continue; // no issue number or loki suffix — skip
    const dir = path.dirname(f.rel);
    const key = `${dir}/${base}`;
    if (!clusters.has(key)) clusters.set(key, { base: key, files: [] });
    clusters.get(key).files.push({ rel: f.rel, tests: f.tests });
  }
  return [...clusters.values()]
    .filter(c => c.files.length >= 2)
    .map(c => ({ ...c, totalTests: c.files.reduce((s, f) => s + f.tests, 0) }))
    .sort((a, b) => b.files.length - a.files.length);
}

/**
 * Find over-tested source files (avg hit count > threshold).
 */
function findOverTested(perFile, minAvgHits = 20, minLines = 5) {
  return Object.entries(perFile)
    .filter(([, d]) => d.hit >= minLines && d.totalHitCount / d.hit > minAvgHits)
    .map(([f, d]) => ({ file: f, avgHits: (d.totalHitCount / d.hit).toFixed(0), pct: (d.hit / d.lines * 100).toFixed(1) }))
    .sort((a, b) => b.avgHits - a.avgHits)
    .slice(0, 12);
}

/**
 * Find low-coverage files (0–20%, >10 lines) — sorted by coverage asc.
 */
function findLowCoverage(perFile, maxPct = 20, minLines = 10) {
  return Object.entries(perFile)
    .filter(([f, d]) => d.lines >= minLines && !f.includes("node_modules") && !f.includes(".next/"))
    .map(([f, d]) => ({ file: f, pct: d.lines > 0 ? (d.hit / d.lines * 100) : 0, hit: d.hit, lines: d.lines }))
    .filter(d => d.pct < maxPct)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 12);
}

// ── Complexity analysis section ──────────────────────────────────────────────

function renderComplexitySection(data) {
  const complexityIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9920a" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>`;

  if (!data || !data.summary) {
    return `
  <!-- Complexity Analysis -->
  <div class="section">
    <div class="section-header">${complexityIcon}<h2>Complexity Analysis</h2></div>
    <p style="color:var(--stone);font-size:0.85rem">No complexity data available. Run <code>node quality/scripts/complexity-analysis.mjs</code> to generate.</p>
  </div>`;
  }

  const { summary, functions } = data;
  const top15 = functions.slice(0, 15);
  const distTotal = summary.totalFunctions || 1;
  const barPct = (count) => ((count / distTotal) * 100).toFixed(1);
  const riskCls = (cat) => cat === "LOW" ? "hi" : cat === "MODERATE" ? "med" : "lo";
  const riskLabel = (cat) => cat.replace("_", " ");

  let healthVerdict, healthColor;
  if (summary.lowPct >= 80) {
    healthVerdict = "Excellent — well-factored, testable codebase";
    healthColor = "var(--green)";
  } else if (summary.lowPct >= 60) {
    healthVerdict = "Good — room to simplify HIGH/VERY HIGH functions";
    healthColor = "var(--gold)";
  } else {
    healthVerdict = "Needs attention — too many complex, hard-to-test functions";
    healthColor = "var(--red)";
  }

  let html = `
  <!-- Complexity Analysis -->
  <div class="section">
    <div class="section-header">${complexityIcon}<h2>Complexity Analysis</h2></div>
    <p style="color:var(--stone);font-size:0.85rem;margin-bottom:1rem">
      Cyclomatic complexity per function — measures independent code paths. Lower is better.
      <a href="complexity/index.html" style="color:var(--gold)">Full report</a>
    </p>

    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card gold"><div class="value">${summary.totalFunctions}</div><div class="label">Functions</div></div>
      <div class="stat-card ${summary.avgComplexity <= 5 ? 'green' : summary.avgComplexity <= 10 ? 'gold' : 'red'}"><div class="value">${summary.avgComplexity}</div><div class="label">Avg Complexity</div></div>
      <div class="stat-card gold"><div class="value">${summary.medianComplexity}</div><div class="label">Median</div></div>
      <div class="stat-card ${summary.maxComplexity <= 10 ? 'gold' : 'red'}"><div class="value">${summary.maxComplexity}</div><div class="label">Max</div></div>
    </div>

    <div style="margin:1.5rem 0">
      <div style="display:flex;align-items:center;gap:0.75rem;margin:0.4rem 0">
        <span style="width:90px;text-align:right;font-size:0.8rem;font-weight:600;color:var(--green)">LOW (1-5)</span>
        <div style="flex:1;background:var(--surface2);height:20px;border-radius:4px;overflow:hidden">
          <div style="width:${barPct(summary.distribution.LOW)}%;height:100%;background:var(--green);border-radius:4px"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;min-width:70px">${summary.distribution.LOW} (${(summary.distribution.LOW / distTotal * 100).toFixed(0)}%)</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;margin:0.4rem 0">
        <span style="width:90px;text-align:right;font-size:0.8rem;font-weight:600;color:var(--gold)">MOD (6-10)</span>
        <div style="flex:1;background:var(--surface2);height:20px;border-radius:4px;overflow:hidden">
          <div style="width:${barPct(summary.distribution.MODERATE)}%;height:100%;background:var(--gold);border-radius:4px"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;min-width:70px">${summary.distribution.MODERATE} (${(summary.distribution.MODERATE / distTotal * 100).toFixed(0)}%)</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;margin:0.4rem 0">
        <span style="width:90px;text-align:right;font-size:0.8rem;font-weight:600;color:var(--red)">HIGH (11-20)</span>
        <div style="flex:1;background:var(--surface2);height:20px;border-radius:4px;overflow:hidden">
          <div style="width:${barPct(summary.distribution.HIGH)}%;height:100%;background:var(--red);border-radius:4px"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;min-width:70px">${summary.distribution.HIGH} (${(summary.distribution.HIGH / distTotal * 100).toFixed(0)}%)</span>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;margin:0.4rem 0">
        <span style="width:90px;text-align:right;font-size:0.8rem;font-weight:600;color:var(--red);font-weight:700">CRIT (21+)</span>
        <div style="flex:1;background:var(--surface2);height:20px;border-radius:4px;overflow:hidden">
          <div style="width:${barPct(summary.distribution.VERY_HIGH)}%;height:100%;background:#dc2626;border-radius:4px"></div>
        </div>
        <span style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;min-width:70px">${summary.distribution.VERY_HIGH} (${(summary.distribution.VERY_HIGH / distTotal * 100).toFixed(0)}%)</span>
      </div>
    </div>

    <h3 style="color:var(--gold);font-family:'Cinzel',serif;font-size:0.9rem;letter-spacing:0.08em;margin:1.5rem 0 0.75rem">Most Complex Functions (Top 15)</h3>
    <table>
      <thead><tr><th>#</th><th>Function</th><th>File</th><th>Line</th><th>Complexity</th><th>Risk</th></tr></thead>
      <tbody>
${top15.map((f, i) => {
  const shortFile = f.file.replace("development/frontend/src/", "");
  return `        <tr>
          <td>${i + 1}</td>
          <td><code>${f.function}</code></td>
          <td><code>${shortFile}</code></td>
          <td>${f.line}</td>
          <td class="${riskCls(f.category)}"><strong>${f.complexity}</strong></td>
          <td class="${riskCls(f.category)}">${riskLabel(f.category)}</td>
        </tr>`;
}).join("\n")}
      </tbody>
    </table>

    <h3 style="color:var(--gold);font-family:'Cinzel',serif;font-size:0.9rem;letter-spacing:0.08em;margin:1.5rem 0 0.75rem">Recommendations</h3>
${summary.distribution.VERY_HIGH > 0 ? `    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:1rem 1.25rem;margin:0.5rem 0">
      <div style="font-weight:700;font-size:0.85rem;color:var(--red);margin-bottom:0.3rem">Critical: ${summary.distribution.VERY_HIGH} function(s) with complexity &gt; 20</div>
      <div style="font-size:0.8rem;color:var(--stone)">These functions have too many decision paths to test effectively. Break them into smaller, focused functions with a single responsibility.</div>
    </div>` : ""}
${summary.distribution.HIGH > 0 ? `    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:1rem 1.25rem;margin:0.5rem 0">
      <div style="font-weight:700;font-size:0.85rem;color:var(--red);margin-bottom:0.3rem">${summary.distribution.HIGH} function(s) with complexity 11&ndash;20</div>
      <div style="font-size:0.8rem;color:var(--stone)">Review for testability. Consider extracting conditional logic into helper functions or using early returns to reduce nesting.</div>
    </div>` : ""}
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:1rem 1.25rem;margin:0.5rem 0">
      <div style="font-weight:700;font-size:0.85rem;color:${healthColor};margin-bottom:0.3rem">Overall: ${summary.lowPct.toFixed(0)}% of functions are LOW complexity</div>
      <div style="font-size:0.8rem;color:var(--stone)">${healthVerdict}</div>
    </div>
  </div>`;

  return html;
}

function renderOverlapSection(twins, clusters, overTested, lowCoverage) {
  const circleIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9920a" stroke-width="2"><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></svg>`;
  const warnIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

  const subhead = (t) => `<h3 style="color:var(--gold);font-family:'Cinzel',serif;font-size:0.9rem;letter-spacing:0.08em;margin:1.5rem 0 0.75rem">${t}</h3>`;

  const twinCullEstimate = twins.reduce((s, t) => s + t.lokiTests, 0);

  // overlap section
  let overlapHtml = `
  <div class="section">
    <div class="section-header">${circleIcon}<h2>Overlapping Coverage</h2></div>
    <p style="color:var(--stone);font-size:0.85rem;margin-bottom:1rem">Test files fighting the same ground twice. Loki twins, issue-numbered clusters, and directory splits consume redundant test budget on already-covered sources.</p>

    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="stat-card ${twins.length > 0 ? 'red' : 'green'}"><div class="value">${twins.length}</div><div class="label">Loki Twin Pairs</div></div>
      <div class="stat-card ${clusters.length > 0 ? 'red' : 'green'}"><div class="value">${clusters.length}</div><div class="label">Issue Clusters</div></div>
      <div class="stat-card gold"><div class="value">~${twinCullEstimate}</div><div class="label">Redundant Tests (twins)</div></div>
      <div class="stat-card gold"><div class="value">${clusters.reduce((s,c)=>s+Math.max(0,c.files.length-1),0)}</div><div class="label">Excess Cluster Files</div></div>
    </div>`;

  if (twins.length > 0) {
    overlapHtml += subhead("Loki Twin Pairs — merge edge cases into parent, delete twin");
    overlapHtml += `<table>
      <thead><tr><th>Regular File</th><th>Loki Twin</th><th>Reg Tests</th><th>Loki Tests</th><th>Action</th></tr></thead>
      <tbody>`;
    for (const t of twins) {
      const name = path.basename(t.base);
      overlapHtml += `<tr>
        <td><code>${name}</code></td>
        <td><code>${path.basename(t.loki)}</code></td>
        <td>${t.baseTests}</td>
        <td class="lo">${t.lokiTests}</td>
        <td class="med">Merge unique cases → delete twin</td>
      </tr>`;
    }
    overlapHtml += `</tbody></table>`;
  }

  if (clusters.length > 0) {
    overlapHtml += subhead("Issue-Numbered Clusters — consolidate into canonical files");
    overlapHtml += `<table>
      <thead><tr><th>Base</th><th>Files</th><th>Total Tests</th><th>Action</th></tr></thead>
      <tbody>`;
    for (const c of clusters) {
      overlapHtml += `<tr>
        <td><code>${path.basename(c.base)}</code></td>
        <td class="lo">${c.files.length}</td>
        <td>${c.totalTests}</td>
        <td class="med">Consolidate → ${Math.max(1, c.files.length - (c.files.length - 1))} canonical file(s)</td>
      </tr>`;
      for (const f of c.files) {
        overlapHtml += `<tr><td colspan="4" style="color:var(--stone);font-size:0.78rem;padding-left:2rem">↳ ${path.basename(f.rel)} (${f.tests} tests)</td></tr>`;
      }
    }
    overlapHtml += `</tbody></table>`;
  }

  if (overTested.length > 0) {
    overlapHtml += subhead("Over-Tested Sources — stop adding tests here, focus on gaps");
    overlapHtml += `<table>
      <thead><tr><th>Source File</th><th>Avg Hit ×</th><th>Coverage</th><th>Note</th></tr></thead>
      <tbody>`;
    for (const f of overTested) {
      const shortFile = f.file.replace("development/frontend/src/", "");
      overlapHtml += `<tr>
        <td><code>${shortFile}</code></td>
        <td class="lo"><strong>${f.avgHits}×</strong></td>
        <td class="${parseFloat(f.pct) >= 80 ? 'hi' : 'med'}">${f.pct}%</td>
        <td class="dim">Transitive dep or multiple test owners — no new tests needed</td>
      </tr>`;
    }
    overlapHtml += `</tbody></table>`;
  }

  overlapHtml += `</div>`;

  // coverage gaps section
  let gapsHtml = `
  <div class="section">
    <div class="section-header">${warnIcon}<h2>Coverage Gaps — Priority Targets</h2></div>
    <p style="color:var(--stone);font-size:0.85rem;margin-bottom:0.75rem">Files below 20% coverage with &gt;10 lines. Sorted by coverage ascending — these are where new tests deliver real value.</p>`;

  if (lowCoverage.length > 0) {
    const riskMap = {
      "AuthContext": "HIGH", "verify-id-token": "HIGH", "refresh-session": "HIGH",
      "entitlement/cache": "HIGH", "household": "HIGH", "stripe/api": "HIGH",
      "stripe/webhook": "HIGH", "require-auth": "HIGH",
      "useDriveToken": "MED", "sheets-api": "MED", "gis": "MED", "pack-status": "MED",
      "CsvUpload": "MED",
    };
    const risk = (f) => {
      for (const [k, v] of Object.entries(riskMap)) if (f.includes(k)) return v;
      return "LOW";
    };
    const riskCls = { HIGH: "lo", MED: "med", LOW: "hi" };
    gapsHtml += `<table>
      <thead><tr><th>Source File</th><th>Lines Hit</th><th>Coverage</th><th>Risk</th></tr></thead>
      <tbody>`;
    for (const f of lowCoverage) {
      const shortFile = f.file.replace("development/frontend/src/", "src/");
      const r = risk(f.file);
      gapsHtml += `<tr>
        <td><code>${shortFile}</code></td>
        <td>${f.hit}/${f.lines}</td>
        <td class="lo">${f.pct.toFixed(1)}%</td>
        <td class="${riskCls[r]}">${r}</td>
      </tr>`;
    }
    gapsHtml += `</tbody></table>`;
    const highCount = lowCoverage.filter(f => risk(f.file) === "HIGH").length;
    gapsHtml += `<p style="color:var(--stone);font-size:0.8rem;margin-top:0.75rem">${highCount} HIGH-risk files below 20%. Covering them closes real auth/payment attack surface, not just a number.</p>`;
  } else {
    gapsHtml += `<p style="color:var(--green);font-size:0.85rem">No files below 20% coverage. The shield wall holds.</p>`;
  }

  gapsHtml += `</div>`;

  return overlapHtml + gapsHtml;
}

/** Copy Loki's profile image to reports dir for the HTML report */
function copyLokiProfile() {
  const src = path.join(REPO_ROOT, ".claude/agents/profiles/loki-dark.png");
  const dest = path.join(REPO_ROOT, "quality/reports/loki-dark.png");
  if (existsSync(src)) copyFileSync(src, dest);
}

// ── Shield / Sword icon SVGs ──────────────────────────────────────────────────

const shieldIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9920a" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const swordIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c9920a" stroke-width="2"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/></svg>`;
const skullIcon = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="10" r="7"/><circle cx="9" cy="9" r="1.5" fill="#ef4444"/><circle cx="15" cy="9" r="1.5" fill="#ef4444"/><path d="M9 21v-6h6v6"/><path d="M12 15v6"/></svg>`;

// ── HTML generation ───────────────────────────────────────────────────────────

async function main() {
  log("Generating HTML quality report...");
  copyLokiProfile();

  const vitestFiles = walkDir(FRONTEND_TESTS, [".test.ts", ".test.tsx"]);
  const e2eFiles = walkDir(E2E_TESTS, [".spec.ts", ".spec.tsx"]);
  const allFiles = [...vitestFiles, ...e2eFiles];

  const fileData = allFiles.map((fp) => {
    const content = readFileSync(fp, "utf-8");
    return { fp, rel: path.relative(REPO_ROOT, fp).replace(/\\/g, "/"), content, tests: countTests(content), category: categorise(fp), bullshit: detectBullshit(fp, content) };
  });

  const CATEGORIES = [
    { id: "unit", label: "Unit", icon: "⚡", desc: "Pure logic, lib/, utilities" },
    { id: "hook", label: "Hook", icon: "🪝", desc: "React hooks" },
    { id: "component", label: "Component", icon: "🧱", desc: "Render tests (.tsx)" },
    { id: "api", label: "API / Route", icon: "🚪", desc: "Route handlers, auth, integration" },
    { id: "e2e", label: "E2E", icon: "🌐", desc: "Playwright browser tests" },
  ];

  const byCategory = {};
  for (const cat of CATEGORIES) {
    const files = fileData.filter(f => f.category === cat.id);
    byCategory[cat.id] = { ...cat, files, fileCount: files.length, testCount: files.reduce((s, f) => s + f.tests, 0), bullshitFiles: files.filter(f => f.bullshit.length > 0) };
  }

  const totalFiles = fileData.length;
  const totalTests = fileData.reduce((s, f) => s + f.tests, 0);
  const bullshitFiles = fileData.filter(f => f.bullshit.length > 0);
  const totalBullshitTests = bullshitFiles.reduce((s, f) => s + f.tests, 0);

  // Overlap analysis — run before HTML generation
  const vitestLcovPath = path.join(COVERAGE_DIR, "vitest/lcov.info");
  const perFile = parseLcovPerFile(vitestLcovPath, REPO_ROOT);
  const lokiTwins = findLokiTwins(fileData);
  const issueClusters = findIssueClusters(fileData);
  const overTested = findOverTested(perFile);
  const lowCoverage = findLowCoverage(perFile);
  const overlapSectionHtml = renderOverlapSection(lokiTwins, issueClusters, overTested, lowCoverage);

  // Complexity analysis — read from pre-generated JSON if available
  const complexityJsonPath = path.join(REPO_ROOT, "quality/reports/complexity/complexity-report.json");
  let complexityData = null;
  if (existsSync(complexityJsonPath)) {
    try {
      complexityData = JSON.parse(readFileSync(complexityJsonPath, "utf-8"));
    } catch { /* ignore parse errors */ }
  }
  const complexitySectionHtml = renderComplexitySection(complexityData);

  const lcovVitest = parseLcov(path.join(COVERAGE_DIR, "vitest/lcov.info"));
  const lcovPlaywright = parseLcov(path.join(COVERAGE_DIR, "playwright/lcov.info"));
  const lcovCombined = parseLcov(path.join(COVERAGE_DIR, "combined/lcov.info"));

  const combinedLinePct = lcovCombined ? parseFloat(lcovCombined.lines.pct) : (lcovVitest ? parseFloat(lcovVitest.lines.pct) : 0);
  const isClean = bullshitFiles.length === 0;
  const isCoverageHealthy = combinedLinePct >= 50;
  const isShieldSecure = isClean && isCoverageHealthy;
  const dateStr = new Date().toISOString().split('T')[0];
  const now = new Date().toLocaleString("en-US", { timeZone: "UTC", hour12: false });

  // Load quotes
  const decreesPath = path.join(__dirname, "templates/decrees.json");
  const decrees = existsSync(decreesPath) ? JSON.parse(readFileSync(decreesPath, "utf-8")) : null;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const pool = decrees ? (isShieldSecure ? decrees.seal : decrees.changeOrder) : null;
  const headerQuote = pool ? pick(pool.headers) : "The shield wall awaits judgment.";
  const verdictQuote = pool ? pick(pool.verdicts) : (isShieldSecure ? "SECURE" : "WANTING");
  const closingQuote = pool ? pick(pool.closings) : "Attend to the decree.";
  const taglineQuote = pool ? pick(pool.taglines) : "the wolf watches";

  // Coverage bar helper
  const coverBar = (pct) => {
    const n = parseFloat(pct);
    const color = n >= 80 ? "#4ade80" : n >= 60 ? "#c9920a" : "#ef4444";
    return `<div class="cover-bar"><div class="cover-fill" style="width:${n}%;background:${color}"></div></div>`;
  };

  const coverCell = (data, field) => {
    if (!data) return `<td class="dim">—</td>`;
    const d = data[field];
    const n = parseFloat(d.pct);
    const cls = n >= 80 ? "hi" : n >= 60 ? "med" : "lo";
    return `<td class="${cls}">${d.pct}% <span class="frac">${d.hit}/${d.total}</span></td>`;
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fenrir Ledger — Quality Report</title>
<style>
  :root {
    --void: #07070d;
    --surface: #0f0f16;
    --surface2: #161620;
    --hover: #1a1a22;
    --gold: #c9920a;
    --gold-dim: #8b6a0a;
    --stone: #8b8680;
    --dirt: #3a2e22;
    --green: #4ade80;
    --green-dim: #1a3a24;
    --red: #ef4444;
    --red-dim: #3a1a1a;
    --yellow: #f9cd0b;
    --text: #e8e8e0;
    --text-dim: #888;
    --border: #2a2a34;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--void); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }

  .container { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }

  /* Header */
  .header { text-align: center; padding: 3rem 0 2rem; border-bottom: 2px solid var(--gold); margin-bottom: 2rem; }
  .header h1 { font-family: 'Cinzel', serif; font-size: 1.8rem; color: var(--gold); letter-spacing: 0.15em; text-transform: uppercase; }
  .header .subtitle { color: var(--stone); font-size: 0.85rem; margin-top: 0.5rem; }
  .header .runes { font-size: 1.4rem; letter-spacing: 0.3em; color: var(--gold); opacity: 0.5; margin-bottom: 0.5rem; }

  /* Decree */
  .decree { background: var(--surface); border: 1px solid var(--gold); border-radius: 8px; padding: 2.5rem 2rem; margin-bottom: 2rem; text-align: center; position: relative; overflow: hidden; }
  .decree::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, transparent, var(--gold), transparent); }
  .decree.secure { border-color: var(--green); }
  .decree.secure::before { background: linear-gradient(90deg, transparent, var(--green), transparent); }
  .decree.wanting { border-color: var(--red); }
  .decree.wanting::before { background: linear-gradient(90deg, transparent, var(--red), transparent); }
  .decree-type { font-family: 'Cinzel', serif; font-size: 0.75rem; letter-spacing: 0.4em; text-transform: uppercase; color: var(--stone); margin-bottom: 0.5rem; }
  .decree-title { font-family: 'Cinzel', serif; font-size: 1.6rem; color: var(--gold); letter-spacing: 0.1em; margin-bottom: 0.3rem; }
  .decree.secure .decree-title { color: var(--green); }
  .decree.wanting .decree-title { color: var(--red); }
  .decree-quote { font-style: italic; color: var(--text-dim); margin: 1.5rem 0; font-size: 1.05rem; }
  .decree-verdict { font-family: 'Cinzel', serif; font-size: 1.1rem; letter-spacing: 0.15em; text-transform: uppercase; padding: 0.6rem 1.5rem; display: inline-block; border: 1px solid; border-radius: 4px; margin: 1rem 0; }
  .decree.secure .decree-verdict { color: var(--green); border-color: var(--green); background: var(--green-dim); }
  .decree.wanting .decree-verdict { color: var(--red); border-color: var(--red); background: var(--red-dim); }
  .decree-meta { display: flex; justify-content: center; gap: 2rem; margin: 1rem 0; font-size: 0.85rem; color: var(--stone); }
  .decree-meta dt { font-weight: 700; color: var(--gold); }
  .decree-closing { font-style: italic; color: var(--text-dim); margin-top: 1.5rem; }
  .decree-seal { margin-top: 2rem; }
  .decree-tagline { font-size: 0.8rem; color: var(--gold); opacity: 0.5; letter-spacing: 0.1em; margin-top: 0.5rem; }
  .decree-seal-row { display: flex; align-items: center; justify-content: center; gap: 1.5rem; margin-top: 2rem; flex-wrap: wrap; }
  .loki-profile { width: 120px; height: 120px; border-radius: 50%; border: 2px solid var(--gold); object-fit: cover; opacity: 0.9; box-shadow: 0 0 20px rgba(201, 146, 10, 0.2); }

  /* Deficiencies */
  .deficiencies { text-align: left; max-width: 500px; margin: 1.5rem auto; }
  .deficiencies h4 { color: var(--gold); font-size: 0.85rem; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5rem; }
  .deficiencies li { color: var(--text); margin: 0.3rem 0; font-size: 0.9rem; }
  .deficiencies .actions li { color: var(--stone); }

  /* Sections */
  .section { margin-bottom: 2.5rem; }
  .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .section-header h2 { font-family: 'Cinzel', serif; font-size: 1.1rem; color: var(--gold); letter-spacing: 0.08em; }

  /* Stats grid */
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; text-align: center; }
  .stat-card .value { font-family: 'JetBrains Mono', monospace; font-size: 1.6rem; font-weight: 700; }
  .stat-card .label { font-size: 0.75rem; color: var(--stone); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.3rem; }
  .stat-card.green .value { color: var(--green); }
  .stat-card.gold .value { color: var(--gold); }
  .stat-card.red .value { color: var(--red); }

  /* Coverage gauges */
  .gauges { display: flex; justify-content: center; gap: 2rem; flex-wrap: wrap; margin: 1.5rem 0; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin: 1rem 0; }
  th { background: var(--dirt); color: var(--gold); font-weight: 700; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.75rem; text-align: left; }
  td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--border); font-size: 0.85rem; }
  tr:hover td { background: var(--hover); }
  td.hi { color: var(--green); font-weight: 600; }
  td.med { color: var(--gold); font-weight: 600; }
  td.lo { color: var(--red); font-weight: 600; }
  td.dim { color: var(--text-dim); }
  .frac { font-size: 0.7rem; color: var(--stone); margin-left: 0.3rem; }
  td a { color: var(--gold); text-decoration: none; }
  td a:hover { text-decoration: underline; }

  /* Cover bar */
  .cover-bar { background: var(--border); height: 6px; border-radius: 3px; overflow: hidden; min-width: 80px; }
  .cover-fill { height: 100%; border-radius: 3px; transition: width 0.5s ease; }

  /* Category cards */
  .cat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
  .cat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; }
  .cat-card .cat-icon { font-size: 1.2rem; }
  .cat-card .cat-name { font-weight: 700; color: var(--text); font-size: 0.9rem; }
  .cat-card .cat-count { font-family: 'JetBrains Mono', monospace; font-size: 1.4rem; font-weight: 700; color: var(--gold); margin: 0.3rem 0; }
  .cat-card .cat-files { font-size: 0.75rem; color: var(--stone); }
  .cat-card .cat-desc { font-size: 0.7rem; color: var(--text-dim); margin-top: 0.3rem; }
  .cat-card .cat-status { font-size: 0.7rem; margin-top: 0.3rem; }
  .cat-card .cat-status.clean { color: var(--green); }
  .cat-card .cat-status.flagged { color: var(--red); }

  /* Footer */
  .footer { text-align: center; padding: 2rem 0; border-top: 1px solid var(--border); margin-top: 2rem; font-size: 0.75rem; color: var(--text-dim); }

  /* Quality shield */
  .quality-shield { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 0.3rem 0.8rem; font-size: 0.8rem; }
  .quality-shield.clean { border-color: var(--green); color: var(--green); }
  .quality-shield.dirty { border-color: var(--red); color: var(--red); }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <div class="header">
    <div class="runes">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</div>
    <h1>Quality Report</h1>
    <div class="subtitle">Generated ${now} UTC</div>
  </div>

  <!-- Loki's Decree -->
  <div class="decree ${isShieldSecure ? 'secure' : 'wanting'}">
    <div class="decree-type">${isShieldSecure ? 'Runic Seal of Quality' : 'Formal Change Order'}</div>
    <div class="decree-title">${isShieldSecure ? 'ᛉ The Shield Wall Holds ᛉ' : 'ᚦ Action Required ᚦ'}</div>
    <div class="decree-quote">"${headerQuote}"</div>

    ${isShieldSecure ? '' : `
    <div class="deficiencies">
      <h4>Deficiencies</h4>
      <ul>
        ${!isClean ? `<li><strong>${bullshitFiles.length}</strong> hollow test files (${totalBullshitTests} tests) poisoning the suite</li>` : ''}
        ${!isCoverageHealthy ? `<li>Combined line coverage at <strong>${combinedLinePct.toFixed(1)}%</strong> — below 50% threshold</li>` : ''}
      </ul>
      <h4 style="margin-top:1rem">Required Actions</h4>
      <ul class="actions">
        ${!isClean ? '<li>Delete all flagged hollow test files</li><li>Replace with behavioural tests</li>' : ''}
        ${!isCoverageHealthy ? '<li>Increase coverage to &ge;50% combined lines</li><li>Priority: auth flows, sync engine, import pipeline</li>' : ''}
      </ul>
    </div>
    `}

    <div class="decree-verdict">${verdictQuote}</div>

    <div class="decree-meta">
      <dl><dt>Tests</dt><dd>${totalTests}</dd></dl>
      <dl><dt>Files</dt><dd>${totalFiles}</dd></dl>
      <dl><dt>Coverage</dt><dd>${combinedLinePct.toFixed(1)}%</dd></dl>
      <dl><dt>Hollow</dt><dd>${bullshitFiles.length}</dd></dl>
    </div>

    <div class="decree-closing">"${closingQuote}"</div>

    <div class="decree-seal-row">
      <img src="loki-dark.png" alt="Loki Laufeyson" class="loki-profile"/>
      <div>
        ${lokiSealSvg(dateStr, isShieldSecure)}
        <div class="decree-tagline">ᚠᛖᚾᚱᛁᚱ — ${taglineQuote}</div>
      </div>
    </div>
  </div>

  <!-- Coverage Gauges -->
  <div class="section">
    <div class="section-header">${shieldIcon}<h2>Code Coverage</h2></div>

    <div class="gauges">
      ${lcovCombined ? gaugeRing(lcovCombined.lines.pct, "Combined") : ''}
      ${lcovVitest ? gaugeRing(lcovVitest.lines.pct, "Vitest") : ''}
      ${lcovPlaywright ? gaugeRing(lcovPlaywright.lines.pct, "Playwright") : ''}
    </div>

    <table>
      <thead><tr><th>Report</th><th>Files</th><th>Lines</th><th>Functions</th><th>Branches</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td><a href="coverage/combined/index.html">Combined</a></td>
          <td>${lcovCombined ? lcovCombined.files : '—'}</td>
          ${coverCell(lcovCombined, 'lines')}
          ${coverCell(lcovCombined, 'functions')}
          ${coverCell(lcovCombined, 'branches')}
          <td>${lcovCombined ? coverBar(lcovCombined.lines.pct) : ''}</td>
        </tr>
        <tr>
          <td><a href="coverage/vitest/index.html">Vitest</a></td>
          <td>${lcovVitest ? lcovVitest.files : '—'}</td>
          ${coverCell(lcovVitest, 'lines')}
          ${coverCell(lcovVitest, 'functions')}
          ${coverCell(lcovVitest, 'branches')}
          <td>${lcovVitest ? coverBar(lcovVitest.lines.pct) : ''}</td>
        </tr>
        <tr>
          <td><a href="coverage/playwright/index.html">Playwright</a></td>
          <td>${lcovPlaywright ? lcovPlaywright.files : '—'}</td>
          ${coverCell(lcovPlaywright, 'lines')}
          ${coverCell(lcovPlaywright, 'functions')}
          ${coverCell(lcovPlaywright, 'branches')}
          <td>${lcovPlaywright ? coverBar(lcovPlaywright.lines.pct) : ''}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Test Quality -->
  <div class="section">
    <div class="section-header">${isClean ? shieldIcon : skullIcon}<h2>Test Quality</h2>
      <span class="quality-shield ${isClean ? 'clean' : 'dirty'}">${isClean ? 'Clean — 0 hollow tests' : `${bullshitFiles.length} files flagged`}</span>
    </div>
    ${!isClean ? bullshitFiles.map(f => `<div style="color:var(--red);font-size:0.85rem;margin:0.3rem 0">⚠ ${f.rel} — ${f.tests} tests — ${f.bullshit.map(b => b.label).join(', ')}</div>`).join('\n') : ''}
  </div>

  <!-- Test Inventory -->
  <div class="section">
    <div class="section-header">${swordIcon}<h2>Test Inventory</h2></div>

    <div class="stats-grid">
      <div class="stat-card gold"><div class="value">${totalFiles}</div><div class="label">Test Files</div></div>
      <div class="stat-card gold"><div class="value">${totalTests}</div><div class="label">Test Cases</div></div>
      <div class="stat-card ${isClean ? 'green' : 'red'}"><div class="value">${bullshitFiles.length}</div><div class="label">Hollow Tests</div></div>
      <div class="stat-card green"><div class="value">${CATEGORIES.length}</div><div class="label">Categories</div></div>
    </div>

    <div class="cat-grid">
      ${CATEGORIES.map(cat => {
        const d = byCategory[cat.id];
        const pct = totalTests > 0 ? ((d.testCount / totalTests) * 100).toFixed(0) : 0;
        return `<div class="cat-card">
          <span class="cat-icon">${cat.icon}</span> <span class="cat-name">${cat.label}</span>
          <div class="cat-count">${d.testCount}</div>
          <div class="cat-files">${d.fileCount} files · ${pct}% of suite</div>
          <div class="cat-desc">${cat.desc}</div>
          <div class="cat-status ${d.bullshitFiles.length === 0 ? 'clean' : 'flagged'}">${d.bullshitFiles.length === 0 ? '✓ clean' : `⚠ ${d.bullshitFiles.length} flagged`}</div>
        </div>`;
      }).join('\n')}
    </div>

    <table>
      <thead><tr><th>Category</th><th>Files</th><th>Tests</th><th>Share</th><th>Status</th></tr></thead>
      <tbody>
        ${CATEGORIES.map(cat => {
          const d = byCategory[cat.id];
          const pct = totalTests > 0 ? ((d.testCount / totalTests) * 100).toFixed(1) : "0.0";
          return `<tr>
            <td>${cat.icon} ${cat.label}</td>
            <td>${d.fileCount}</td>
            <td>${d.testCount}</td>
            <td>${pct}%</td>
            <td class="${d.bullshitFiles.length === 0 ? 'hi' : 'lo'}">${d.bullshitFiles.length === 0 ? '✓ clean' : `⚠ ${d.bullshitFiles.length} flagged`}</td>
          </tr>`;
        }).join('\n')}
      </tbody>
    </table>
  </div>

  ${overlapSectionHtml}

  ${complexitySectionHtml}

  <!-- Test Reports -->
  <div class="section">
    <div class="section-header">${swordIcon}<h2>Test Reports</h2></div>
    <p style="color:var(--muted);font-size:0.85rem;margin-bottom:1rem">
      Interactive HTML test reports from the last test run.
      Served via <code>npx serve quality/reports -p 7463</code> (started automatically by /coverage-report).
    </p>
    <table>
      <thead><tr><th>Report</th><th>Location</th><th>View</th></tr></thead>
      <tbody>
        <tr>
          <td>Vitest (unit/integration)</td>
          <td><code>test-report-vitest/</code></td>
          <td>${existsSync(path.join(REPO_ROOT, "quality/reports/test-report-vitest/index.html"))
            ? '<a href="http://localhost:7463/test-report-vitest/" style="color:var(--gold)">Open</a>'
            : '<span style="color:var(--muted)">not generated</span>'}</td>
        </tr>
        <tr>
          <td>Playwright (E2E)</td>
          <td><code>test-report-playwright/</code></td>
          <td>${existsSync(path.join(REPO_ROOT, "quality/reports/test-report-playwright/index.html"))
            ? '<a href="http://localhost:7463/test-report-playwright/" style="color:var(--gold)">Open</a>'
            : '<span style="color:var(--muted)">not generated</span>'}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    Generated by <code>quality/scripts/quality-report-html.mjs</code> ·
    <a href="coverage/index.html" style="color:var(--gold)">Coverage Index</a> ·
    Fenrir Ledger ${dateStr}
  </div>

</div>
</body>
</html>`;

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, html, "utf-8");
  log(`HTML quality report written to quality/reports/quality-report.html`);

  // Emit machine-readable cull list for the skill post-run prompt
  const bullshitPct = totalTests > 0 ? ((totalBullshitTests / totalTests) * 100).toFixed(1) : "0.0";
  const cullJson = {
    generated: new Date().toISOString(),
    totalFiles,
    totalTests,
    totalCullFiles: bullshitFiles.length,
    totalCullTests: totalBullshitTests,
    pctOfSuite: bullshitPct,
    culls: bullshitFiles.map(f => ({
      file: f.rel,
      tests: f.tests,
      patterns: f.bullshit.map(b => b.id),
      primaryPattern: f.bullshit[0]?.id ?? "unknown",
      primaryLabel: f.bullshit[0]?.label ?? "Unknown",
    })),
  };
  const cullPath = path.join(REPO_ROOT, "quality/reports/cull-list.json");
  writeFileSync(cullPath, JSON.stringify(cullJson, null, 2), "utf-8");
  log(`Cull list written to quality/reports/cull-list.json (${bullshitFiles.length} files flagged)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
