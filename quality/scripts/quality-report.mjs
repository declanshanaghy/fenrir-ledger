#!/usr/bin/env node
/**
 * quality-report.mjs — Generate quality/reports/quality-report.md
 *
 * Section order:
 *   1. Test Quality Analysis (bullshit detection)
 *   2. Code Coverage
 *   3. Test Inventory (condensed — no per-file listing)
 *
 * Usage:
 *   node quality/scripts/quality-report.mjs
 *
 * Output:
 *   quality/reports/quality-report.md
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_TESTS = path.join(REPO_ROOT, "development/frontend/src/__tests__");
const E2E_TESTS = path.join(REPO_ROOT, "quality/test-suites");
const COVERAGE_DIR = path.join(REPO_ROOT, "quality/reports/coverage");
const OUTPUT_PATH  = path.join(REPO_ROOT, "quality/reports/quality-report.md");
const CULL_PATH    = path.join(REPO_ROOT, "quality/reports/cull-list.json");

// ── Helpers ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
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
    if (line.startsWith("SF:"))  files++;
    if (line.startsWith("LF:"))  lf  += parseInt(line.slice(3),  10) || 0;
    if (line.startsWith("LH:"))  lh  += parseInt(line.slice(3),  10) || 0;
    if (line.startsWith("FNF:")) fnf += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("FNH:")) fnh += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("BRF:")) brf += parseInt(line.slice(4), 10) || 0;
    if (line.startsWith("BRH:")) brh += parseInt(line.slice(4), 10) || 0;
  }
  const pct = (hit, total) => total > 0 ? ((hit / total) * 100).toFixed(1) : "0.0";
  return {
    files,
    lines:     { pct: pct(lh,  lf),  hit: lh,  total: lf  },
    functions: { pct: pct(fnh, fnf), hit: fnh, total: fnf },
    branches:  { pct: pct(brh, brf), hit: brh, total: brf },
  };
}

// ── Categorisation ────────────────────────────────────────────────────────────

function categorise(filePath) {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
  const name = path.basename(filePath);
  if (rel.includes("quality/test-suites")) return "e2e";
  if (name.endsWith(".tsx")) return "component";
  const seg = (d) => rel.includes(`/__tests__/${d}/`) || rel.includes(`/__tests__/${d}`);
  if (seg("hooks")) return "hook";
  if (seg("components") || seg("karl-bling") || seg("pages") || seg("layout")) return "component";
  if (
    seg("integration") || seg("admin") || seg("api") || seg("auth") ||
    seg("sync") || seg("stripe") || seg("trial") || seg("household") ||
    seg("health") || name.includes(".integration.")
  ) return "api";
  return "unit";
}

// ── Bullshit detection ────────────────────────────────────────────────────────

const BULLSHIT_CHECKS = [
  {
    id: "vacuous",
    label: "Vacuous Assertions",
    wolf: "These tests cannot fail. They exist only to inflate the count — `expect(true).toBe(true)` is not a test, it is a confession.",
    detect: (content) => /expect\(\s*true\s*\)\s*\.\s*(toBe|toEqual)\s*\(\s*true\s*\)/.test(content),
  },
  {
    id: "infra-yaml",
    label: "Infrastructure YAML Tests",
    wolf: "The wolf does not guard YAML files. These tests read Helm or K8s manifests and assert on their structure — config, not code. When you rename a label, they cry. They are cowards.",
    detect: (content) =>
      /readFileSync/.test(content) &&
      /(\.yaml|\.yml|helm|pdb|deployment|values|Chart)/.test(content),
  },
  {
    id: "css-string",
    label: "CSS String Assertion Tests",
    wolf: "A test that reads a `.css` file and checks for a class name is not a test — it is a mirror. It will shatter the moment you rename a colour variable. It tests text. Text is not behaviour.",
    detect: (content) =>
      /readFileSync/.test(content) &&
      /\.css['"`]/.test(content) &&
      /(expect\(css\)|toContain|toMatch)/.test(content),
  },
  {
    id: "source-assert",
    label: "Source File Content Assertions",
    wolf: "These tests open your TypeScript source with `readFileSync` and grep for function names or string literals. They test that you wrote the code you wrote. They will break on a rename. They guard nothing.",
    detect: (content) =>
      /readFileSync/.test(content) &&
      /\.(ts|tsx|js|mjs)['"`]/.test(content) &&
      /(toContain|toMatch|includes)/.test(content),
  },
  {
    id: "static-copy",
    label: "Static Page Copy & Section-Order Tests",
    wolf: "Marketing copy changes. Section order shifts. These tests assert on text that was never a correctness requirement — they are the most expensive tests per value delivered. One copywriter's edit breaks ten of them.",
    detect: (content, filePath) => {
      const name = path.basename(filePath);
      return (
        (name.includes("section-order") || name.includes("features-section") || name.includes("marketing-nav")) &&
        /(getByText|getAllByText|toContain|screen\.get)/.test(content)
      );
    },
  },
];

function detectBullshit(filePath, content) {
  return BULLSHIT_CHECKS
    .filter(({ detect }) => detect(content, filePath))
    .map(({ id, label }) => ({ id, label }));
}

// ── Formatting ────────────────────────────────────────────────────────────────

function badge(pct) {
  const n = parseFloat(pct);
  if (n >= 80) return "🟢";
  if (n >= 60) return "🟡";
  return "🔴";
}

function coverageRow(label, data, link) {
  if (!data) return `| ${label} | — | — | — | — | — |`;
  return (
    `| [${label}](${link}) | ${data.files} | ` +
    `${badge(data.lines.pct)} **${data.lines.pct}%** (${data.lines.hit}/${data.lines.total}) | ` +
    `${badge(data.functions.pct)} **${data.functions.pct}%** (${data.functions.hit}/${data.functions.total}) | ` +
    `${badge(data.branches.pct)} **${data.branches.pct}%** (${data.branches.hit}/${data.branches.total}) | ` +
    `[View →](${link}) |`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  log("Generating quality report...");

  const vitestFiles = walkDir(FRONTEND_TESTS, [".test.ts", ".test.tsx"]);
  const e2eFiles    = walkDir(E2E_TESTS,       [".spec.ts", ".spec.tsx"]);
  const allFiles    = [...vitestFiles, ...e2eFiles];

  const fileData = allFiles.map((fp) => {
    const content = readFileSync(fp, "utf-8");
    const tests   = countTests(content);
    const category = categorise(fp);
    const bullshit = detectBullshit(fp, content);
    const rel = path.relative(REPO_ROOT, fp).replace(/\\/g, "/");
    return { fp, rel, content, tests, category, bullshit };
  });

  const CATEGORIES = [
    { id: "unit",      label: "Unit",             desc: "Pure logic, lib/, utilities — no render, no HTTP" },
    { id: "hook",      label: "Hook",             desc: "React hooks (useCloudSync, useEntitlement, etc.)" },
    { id: "component", label: "Component",        desc: "React component render tests (.tsx)" },
    { id: "api",       label: "API / Route",      desc: "Route handlers, auth middleware, integration" },
    { id: "e2e",       label: "E2E (Playwright)", desc: "End-to-end browser tests in quality/test-suites/" },
  ];

  const byCategory = {};
  for (const cat of CATEGORIES) {
    const files = fileData.filter(f => f.category === cat.id);
    byCategory[cat.id] = {
      ...cat,
      files,
      fileCount: files.length,
      testCount: files.reduce((s, f) => s + f.tests, 0),
      bullshitFiles: files.filter(f => f.bullshit.length > 0),
    };
  }

  const totalFiles = fileData.length;
  const totalTests = fileData.reduce((s, f) => s + f.tests, 0);
  const bullshitFiles = fileData.filter(f => f.bullshit.length > 0);
  const totalBullshitTests = bullshitFiles.reduce((s, f) => s + f.tests, 0);
  const bullshitPct = totalTests > 0
    ? ((totalBullshitTests / totalTests) * 100).toFixed(1)
    : "0.0";

  const lcovVitest     = parseLcov(path.join(COVERAGE_DIR, "vitest/lcov.info"));
  const lcovPlaywright = parseLcov(path.join(COVERAGE_DIR, "playwright/lcov.info"));
  const lcovCombined   = parseLcov(path.join(COVERAGE_DIR, "combined/lcov.info"));

  const now = new Date().toLocaleString("en-US", { timeZone: "UTC", hour12: false });
  const L = [];

  // ── Header ──────────────────────────────────────────────────────────────────
  L.push(`# ⚔️ Fenrir Ledger — Quality Report`);
  L.push(``);
  L.push(`> *The chain holds — or it does not. There is no almost.*`);
  L.push(``);
  L.push(`**Generated:** ${now} UTC · **${totalFiles} test files** · **${totalTests} test cases**`);
  L.push(``);
  L.push(`---`);
  L.push(``);

  // ── 1. TEST QUALITY ANALYSIS (top) ──────────────────────────────────────────
  L.push(`## 🐺 Test Quality Analysis`);
  L.push(``);

  if (bullshitFiles.length === 0) {
    L.push(`The shield wall is clean. No hollow tests detected — every assertion draws blood.`);
  } else {
    const combinedLinePct = lcovCombined ? parseFloat(lcovCombined.lines.pct) : null;
    const phantom = combinedLinePct !== null
      ? ` These ${totalBullshitTests} phantom tests inflate the count without providing real coverage. Remove them and the coverage numbers will be more honest.`
      : "";

    L.push(`**${bullshitFiles.length} files carry dead weight** — ${totalBullshitTests} tests (${bullshitPct}% of the suite) assert on static text, config structure, or always-true conditions.${phantom}`);
    L.push(``);
    L.push(`These tests don't fail when your logic breaks. They fail when you rename a CSS class or reorder a YAML key. That is not a test — that is a trap.`);
    L.push(``);

    for (const check of BULLSHIT_CHECKS) {
      const affected = bullshitFiles.filter(f => f.bullshit.some(b => b.id === check.id));
      if (affected.length === 0) continue;

      const affectedTests = affected.reduce((s, f) => s + f.tests, 0);
      L.push(`### ⚠️ ${check.label}`);
      L.push(``);
      L.push(`> ${check.wolf}`);
      L.push(``);
      L.push(`**${affected.length} file${affected.length > 1 ? "s" : ""} · ${affectedTests} tests — delete them.**`);
      L.push(``);

      // Condensed: group by subdirectory
      const subdirs = {};
      for (const f of affected) {
        const sub = f.rel.split("/").slice(0, -1).join("/");
        subdirs[sub] = (subdirs[sub] || 0) + f.tests;
      }
      for (const [sub, cnt] of Object.entries(subdirs)) {
        L.push(`- \`${sub}/\` — ${cnt} test${cnt !== 1 ? "s" : ""}`);
      }
      L.push(``);
    }
  }

  L.push(`---`);
  L.push(``);

  // ── 2. CODE COVERAGE ────────────────────────────────────────────────────────
  L.push(`## 📊 Code Coverage`);
  L.push(``);

  const hasAnyCoverage = lcovVitest || lcovPlaywright || lcovCombined;
  if (!hasAnyCoverage) {
    L.push(`*No coverage data found. Run \`/coverage-report\` first.*`);
  } else {
    const canonicalLcov = lcovCombined || lcovVitest;
    const combinedLinePct = canonicalLcov ? parseFloat(canonicalLcov.lines.pct) : null;
    const label = lcovCombined ? "Combined" : (lcovVitest ? "Vitest (combined not available)" : null);

    // Verdict sentence
    if (combinedLinePct !== null) {
      if (combinedLinePct >= 80) {
        L.push(`The wolf's territory is well-marked. ${label} line coverage sits at **${canonicalLcov.lines.pct}%** — above the 80% threshold. The shield wall holds.`);
      } else if (combinedLinePct >= 60) {
        L.push(`**${canonicalLcov.lines.pct}%** ${label} line coverage. The line holds — but gaps remain. Sharpen the blade before the next raid.`);
      } else {
        L.push(`**${canonicalLcov.lines.pct}%** ${label} line coverage. Below 60%. The shield wall has holes. Priority gaps: auth flows, import pipeline, Firestore client.`);
      }
      L.push(``);
    }

    L.push(`> 🟢 ≥80% clean kill · 🟡 60–79% survivable wound · 🔴 <60% bleeding out`);
    L.push(``);
    L.push(`| Report | Source Files | Lines | Functions | Branches | Detail |`);
    L.push(`|--------|-------------:|-------|-----------|----------|--------|`);
    L.push(coverageRow("Combined", lcovCombined, "coverage/combined/index.html"));
    L.push(coverageRow("Vitest",   lcovVitest,   "coverage/vitest/index.html"));
    L.push(coverageRow("Playwright", lcovPlaywright, "coverage/playwright/index.html"));
    L.push(``);

    L.push(`**What each report measures:**`);
    L.push(``);
    L.push(`- **[Combined](coverage/combined/index.html)** — merged Vitest + Playwright after stripping \`.next/\` artifacts. The canonical number. ${lcovCombined ? `${lcovCombined.files} source files tracked.` : ""}`);
    L.push(`- **[Vitest](coverage/vitest/index.html)** — in-process unit + integration tests. Fast, precise, covers pure logic and API route handlers. ${lcovVitest ? `${lcovVitest.files} files.` : "No data."}`);
    L.push(`- **[Playwright](coverage/playwright/index.html)** — server-side coverage from E2E runs. Captures SSR + API routes exercised through the browser. Client-rendered components appear at 0% unless they also run server-side. ${lcovPlaywright ? `${lcovPlaywright.files} files tracked (includes \`.next/\` compiled chunks before filtering).` : "No data."}`);
    L.push(``);
    L.push(`[View master coverage index →](coverage/index.html)`);
  }

  L.push(``);
  L.push(`---`);
  L.push(``);

  // ── 3. TEST INVENTORY ───────────────────────────────────────────────────────
  L.push(`## 🗡️ Test Inventory`);
  L.push(``);
  L.push(`The pack runs **${totalFiles} files** carrying **${totalTests} tests**. Here is how the hunt is divided.`);
  L.push(``);
  L.push(`| Category | Files | Tests | Share | What it guards |`);
  L.push(`|----------|------:|------:|------:|----------------|`);
  for (const cat of CATEGORIES) {
    const { fileCount, testCount, desc } = byCategory[cat.id];
    const pct = totalTests > 0 ? ((testCount / totalTests) * 100).toFixed(1) : "0.0";
    L.push(`| **${cat.label}** | ${fileCount} | ${testCount} | ${pct}% | ${desc} |`);
  }
  L.push(``);

  // Per-category summaries (condensed — no file listing)
  for (const cat of CATEGORIES) {
    const { files, fileCount, testCount, bullshitFiles: catBullshit } = byCategory[cat.id];
    if (fileCount === 0) continue;

    const cleanFiles = fileCount - catBullshit.length;
    const flagNote = catBullshit.length > 0
      ? ` · ⚠️ **${catBullshit.length} file${catBullshit.length > 1 ? "s" : ""} flagged** for problematic patterns`
      : ` · ✅ clean`;

    // Top subdirs by test count
    const subdirCounts = {};
    for (const f of files) {
      const parts = f.rel.replace(/\\/g, "/").split("/");
      // Find the segment after __tests__ or test-suites
      const testIdx = parts.findIndex(p => p === "__tests__" || p === "test-suites");
      const candidate = parts[testIdx + 1];
      // Only use candidate as subdir if it's actually a directory (not a .ts/.tsx file)
      const subdir = (testIdx >= 0 && candidate && !candidate.includes(".test.") && !candidate.includes(".spec."))
        ? candidate
        : "(root)";
      subdirCounts[subdir] = (subdirCounts[subdir] || 0) + f.tests;
    }
    const topDirs = Object.entries(subdirCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    L.push(`### ${cat.label} — ${fileCount} files · ${testCount} tests${flagNote}`);
    L.push(``);

    // Short wolf-flavoured summary per category
    const summaries = {
      unit:      `Pure logic. No mocks of the world — only functions and their returns. The fastest tests in the pack.`,
      hook:      `React hooks under fire. State transitions, side effects, and async edge cases — tested without a browser.`,
      component: `Components rendered in isolation. Interaction, conditional rendering, accessibility — the UI layer under scrutiny.`,
      api:       `Route handlers, auth middleware, and integration flows. The gates of the realm. If these fall, nothing is safe.`,
      e2e:       `Full browser runs against the live app. Slow, expensive, and the closest thing to a real user. Use sparingly.`,
    };
    L.push(summaries[cat.id] || "");
    L.push(``);

    if (topDirs.length > 0) {
      L.push(`**Top areas by test count:**`);
      L.push(``);
      for (const [dir, cnt] of topDirs) {
        L.push(`- \`${dir}/\` — ${cnt} test${cnt !== 1 ? "s" : ""}`);
      }
    }
    L.push(``);
  }

  L.push(`---`);
  L.push(``);

  // ── 4. LOKI'S DECREE ───────────────────────────────────────────────────────
  const combinedLinePct = lcovCombined ? parseFloat(lcovCombined.lines.pct) : (lcovVitest ? parseFloat(lcovVitest.lines.pct) : 0);
  const isClean = bullshitFiles.length === 0;
  const isCoverageHealthy = combinedLinePct >= 50;
  const isShieldSecure = isClean && isCoverageHealthy;
  const dateStr = new Date().toISOString().split('T')[0];

  L.push(`---`);
  L.push(``);
  L.push(`<br>`);
  L.push(``);

  if (isShieldSecure) {
    // ── RUNIC SEAL OF QUALITY ──────────────────────────────────────────────
    L.push(`<div align="center">`);
    L.push(``);
    L.push(`# ᛉ`);
    L.push(``);
    L.push(`### R U N I C &nbsp; S E A L &nbsp; O F &nbsp; Q U A L I T Y`);
    L.push(``);
    L.push(`---`);
    L.push(``);
    L.push(`*Issued by the Office of the QA Tester*`);
    L.push(`*Fenrir Ledger — ${dateStr}*`);
    L.push(``);
    L.push(`</div>`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`> *The shield wall stands unbroken.*`);
    L.push(`>`);
    L.push(`> *${totalTests} tests guard the realm. ${totalFiles} files carry the weight.*`);
    L.push(`> *No hollow assertions defile the count.*`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`| | |`);
    L.push(`|---|---|`);
    L.push(`| **Combined Line Coverage** | **${combinedLinePct.toFixed(1)}%** |`);
    L.push(`| **Hollow Tests** | **0** |`);
    L.push(`| **Test Files** | **${totalFiles}** |`);
    L.push(`| **Test Cases** | **${totalTests}** |`);
    L.push(`| **Verdict** | **THE SHIELD WALL IS SECURE** |`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`> *The chains hold. The wolf sleeps.*`);
    L.push(`> *No change order is required at this time.*`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`<div align="center">`);
    L.push(``);
    L.push(`\`\`\``);
    L.push(`                    ╭─────────────────────────╮`);
    L.push(`                    │                         │`);
    L.push(`                    │   ᛚ ᛟ ᚲ ᛁ              │`);
    L.push(`                    │                         │`);
    L.push(`                    │   Loki Laufeyson        │`);
    L.push(`                    │   QA Tester             │`);
    L.push(`                    │   Fenrir Ledger         │`);
    L.push(`                    │                         │`);
    L.push(`                    │   ${dateStr}              │`);
    L.push(`                    │                         │`);
    L.push(`                    ╰─────────────────────────╯`);
    L.push(`\`\`\``);
    L.push(``);
    L.push(`*ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ — the wolf is bound, the ledger is true*`);
    L.push(``);
    L.push(`</div>`);
  } else {
    // ── FORMAL CHANGE ORDER ────────────────────────────────────────────────
    const issues = [];
    if (!isClean) issues.push(`**${bullshitFiles.length}** hollow test file${bullshitFiles.length !== 1 ? 's' : ''} (**${totalBullshitTests}** tests) poisoning the suite`);
    if (!isCoverageHealthy) issues.push(`Combined line coverage at **${combinedLinePct.toFixed(1)}%** — below the **50%** minimum threshold`);

    L.push(`<div align="center">`);
    L.push(``);
    L.push(`# ᚦ`);
    L.push(``);
    L.push(`### F O R M A L &nbsp; C H A N G E &nbsp; O R D E R`);
    L.push(``);
    L.push(`---`);
    L.push(``);
    L.push(`*Issued by the Office of the QA Tester*`);
    L.push(`*Fenrir Ledger — ${dateStr}*`);
    L.push(``);
    L.push(`</div>`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`| | |`);
    L.push(`|---|---|`);
    L.push(`| **TO** | Odin, All-Father and Project Owner |`);
    L.push(`| **FROM** | Loki Laufeyson, QA Tester |`);
    L.push(`| **RE** | Test Quality Deficiencies — Immediate Action Required |`);
    L.push(`| **DATE** | ${dateStr} |`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`> *The shield wall has been inspected and found* ***WANTING.***`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`#### Deficiencies`);
    L.push(``);
    for (const issue of issues) {
      L.push(`- ${issue}`);
    }
    L.push(``);
    L.push(`#### Required Actions`);
    L.push(``);
    let actionNum = 1;
    if (!isClean) {
      L.push(`${actionNum++}. Delete all flagged hollow test files`);
      L.push(`${actionNum++}. Replace with behavioural tests that guard logic`);
    }
    if (!isCoverageHealthy) {
      L.push(`${actionNum++}. Increase coverage to >=50% combined lines`);
      L.push(`${actionNum++}. Priority: auth flows, sync engine, import pipeline`);
    }
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`> *This decree is* ***BINDING*** *until the deficiencies are resolved*`);
    L.push(`> *and a subsequent quality report issues a Runic Seal of Quality.*`);
    L.push(``);
    L.push(`<br>`);
    L.push(``);
    L.push(`<div align="center">`);
    L.push(``);
    L.push(`\`\`\``);
    L.push(`                    ╭─────────────────────────╮`);
    L.push(`                    │                         │`);
    L.push(`                    │   ᛚ ᛟ ᚲ ᛁ              │`);
    L.push(`                    │                         │`);
    L.push(`                    │   Loki Laufeyson        │`);
    L.push(`                    │   QA Tester             │`);
    L.push(`                    │   Fenrir Ledger         │`);
    L.push(`                    │                         │`);
    L.push(`                    │   ${dateStr}              │`);
    L.push(`                    │                         │`);
    L.push(`                    ╰─────────────────────────╯`);
    L.push(`\`\`\``);
    L.push(``);
    L.push(`*ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ — the wolf strains against the chain*`);
    L.push(``);
    L.push(`</div>`);
  }

  L.push(``);
  L.push(`<br>`);
  L.push(``);
  L.push(`---`);
  L.push(``);
  L.push(`*Generated by \`quality/scripts/quality-report.mjs\` · [Coverage index](coverage/index.html)*`);

  mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, L.join("\n"), "utf-8");

  // Emit machine-readable cull list for the skill post-run prompt
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
      primaryLabel:  f.bullshit[0]?.label ?? "Unknown",
    })),
  };
  writeFileSync(CULL_PATH, JSON.stringify(cullJson, null, 2), "utf-8");
  log(`Cull list written to quality/reports/cull-list.json (${bullshitFiles.length} files flagged)`);
  log(`Quality report written to quality/reports/quality-report.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
