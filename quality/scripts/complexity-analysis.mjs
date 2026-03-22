#!/usr/bin/env node
/**
 * complexity-analysis.mjs — Cyclomatic complexity analysis for source files.
 *
 * Walks all .ts/.tsx files under development/ledger/src/ (excluding tests,
 * node_modules), parses each with @typescript-eslint/typescript-estree, and
 * computes cyclomatic complexity per function.
 *
 * Outputs:
 *   quality/reports/complexity/complexity-report.json  — machine-readable
 *   quality/reports/complexity/index.html              — Fenrir-styled HTML
 *
 * Usage:
 *   node quality/scripts/complexity-analysis.mjs
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const SRC_DIR = path.join(REPO_ROOT, "development/ledger/src");
const OUTPUT_DIR = path.join(REPO_ROOT, "quality/reports/complexity");

// Resolve typescript-estree from the ledger's node_modules
const require = createRequire(path.join(REPO_ROOT, "development/ledger/package.json"));
const { parse } = require("@typescript-eslint/typescript-estree");
const { AST_NODE_TYPES } = require("@typescript-eslint/typescript-estree");

function ts() { return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z"); }
function log(msg) { console.log(`[${ts()}] ${msg}`); }

// ── File discovery ───────────────────────────────────────────────────────────

function walkDir(dir, results = []) {
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__" || entry.name === ".next") continue;
      walkDir(full, results);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx") && !entry.name.endsWith(".spec.ts")) {
      results.push(full);
    }
  }
  return results;
}

// ── AST complexity calculation ───────────────────────────────────────────────

/** Decision-point node types that increment cyclomatic complexity */
const DECISION_NODES = new Set([
  AST_NODE_TYPES.IfStatement,
  AST_NODE_TYPES.SwitchCase,
  AST_NODE_TYPES.ForStatement,
  AST_NODE_TYPES.ForInStatement,
  AST_NODE_TYPES.ForOfStatement,
  AST_NODE_TYPES.WhileStatement,
  AST_NODE_TYPES.DoWhileStatement,
  AST_NODE_TYPES.CatchClause,
  AST_NODE_TYPES.ConditionalExpression,
]);

/** Logical expression operators that add decision paths */
const LOGICAL_OPS = new Set(["&&", "||", "??"]);

/**
 * Walk an AST subtree and count decision points.
 * Does NOT recurse into nested function bodies (those are separate functions).
 */
function countDecisionPoints(node) {
  if (!node || typeof node !== "object") return 0;
  let count = 0;

  if (DECISION_NODES.has(node.type)) {
    // SwitchCase: only count non-default cases
    if (node.type === AST_NODE_TYPES.SwitchCase && node.test !== null) {
      count++;
    } else if (node.type !== AST_NODE_TYPES.SwitchCase) {
      count++;
    }
  }

  if (node.type === AST_NODE_TYPES.LogicalExpression && LOGICAL_OPS.has(node.operator)) {
    count++;
  }

  // Recurse into children, but skip nested function bodies
  const FUNC_TYPES = new Set([
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.FunctionExpression,
    AST_NODE_TYPES.ArrowFunctionExpression,
  ]);

  for (const key of Object.keys(node)) {
    if (key === "type" || key === "loc" || key === "range" || key === "parent") continue;
    const child = node[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && item.type) {
          if (FUNC_TYPES.has(item.type)) continue; // skip nested functions
          count += countDecisionPoints(item);
        }
      }
    } else if (child && typeof child === "object" && child.type) {
      if (FUNC_TYPES.has(child.type)) continue;
      count += countDecisionPoints(child);
    }
  }

  return count;
}

/** Extract function name from various declaration patterns */
function getFunctionName(node, parent) {
  // Named function declaration
  if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
    return node.id.name;
  }
  // Method definition
  if (parent?.type === AST_NODE_TYPES.MethodDefinition && parent.key) {
    return parent.key.name || parent.key.value || "(method)";
  }
  // Property with function value: { myFunc: () => {} } or { myFunc: function() {} }
  if (parent?.type === AST_NODE_TYPES.Property && parent.key) {
    return parent.key.name || parent.key.value || "(property)";
  }
  // Variable declarator: const myFunc = () => {}
  if (parent?.type === AST_NODE_TYPES.VariableDeclarator && parent.id) {
    return parent.id.name || "(anonymous)";
  }
  // Export default function
  if (parent?.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
    return "(default export)";
  }
  return "(anonymous)";
}

/**
 * Find all functions in an AST and compute their cyclomatic complexity.
 * Returns [{ name, line, complexity }]
 */
function analyzeFunctions(ast) {
  const functions = [];
  const FUNC_TYPES = new Set([
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.FunctionExpression,
    AST_NODE_TYPES.ArrowFunctionExpression,
  ]);

  function visit(node, parent) {
    if (!node || typeof node !== "object") return;

    if (FUNC_TYPES.has(node.type)) {
      const name = getFunctionName(node, parent);
      const line = node.loc?.start?.line ?? 0;
      const complexity = 1 + countDecisionPoints(node.body);
      functions.push({ name, line, complexity });
      // Still visit function body to find nested functions
    }

    for (const key of Object.keys(node)) {
      if (key === "type" || key === "loc" || key === "range" || key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && item.type) visit(item, node);
        }
      } else if (child && typeof child === "object" && child.type) {
        visit(child, node);
      }
    }
  }

  visit(ast, null);
  return functions;
}

// ── Risk categorization ──────────────────────────────────────────────────────

function riskCategory(complexity) {
  if (complexity <= 5) return "LOW";
  if (complexity <= 10) return "MODERATE";
  if (complexity <= 20) return "HIGH";
  return "VERY_HIGH";
}

function riskColor(cat) {
  switch (cat) {
    case "LOW": return "#4ade80";
    case "MODERATE": return "#c9920a";
    case "HIGH": return "#ef4444";
    case "VERY_HIGH": return "#dc2626";
    default: return "#8b8680";
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  log("Starting cyclomatic complexity analysis...");

  const sourceFiles = walkDir(SRC_DIR);
  log(`Found ${sourceFiles.length} source files to analyze`);

  const allFunctions = [];
  let parseErrors = 0;

  for (const filePath of sourceFiles) {
    const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
    let content;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    let ast;
    try {
      ast = parse(content, {
        loc: true,
        range: false,
        jsx: filePath.endsWith(".tsx"),
        errorOnUnknownASTType: false,
      });
    } catch {
      parseErrors++;
      continue;
    }

    const fns = analyzeFunctions(ast);
    for (const fn of fns) {
      allFunctions.push({
        file: rel,
        function: fn.name,
        line: fn.line,
        complexity: fn.complexity,
        category: riskCategory(fn.complexity),
      });
    }
  }

  // Sort by complexity descending
  allFunctions.sort((a, b) => b.complexity - a.complexity);

  // Compute summary stats
  const complexities = allFunctions.map(f => f.complexity);
  const total = complexities.length;
  const sum = complexities.reduce((s, c) => s + c, 0);
  const avg = total > 0 ? sum / total : 0;
  const sorted = [...complexities].sort((a, b) => a - b);
  const median = total > 0 ? sorted[Math.floor(total / 2)] : 0;
  const max = total > 0 ? sorted[total - 1] : 0;

  const distribution = {
    LOW: allFunctions.filter(f => f.category === "LOW").length,
    MODERATE: allFunctions.filter(f => f.category === "MODERATE").length,
    HIGH: allFunctions.filter(f => f.category === "HIGH").length,
    VERY_HIGH: allFunctions.filter(f => f.category === "VERY_HIGH").length,
  };

  const lowPct = total > 0 ? (distribution.LOW / total * 100) : 0;

  const report = {
    generated: new Date().toISOString(),
    filesAnalyzed: sourceFiles.length,
    parseErrors,
    summary: {
      totalFunctions: total,
      avgComplexity: parseFloat(avg.toFixed(1)),
      medianComplexity: median,
      maxComplexity: max,
      distribution,
      lowPct: parseFloat(lowPct.toFixed(1)),
    },
    functions: allFunctions,
  };

  // Write JSON
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const jsonPath = path.join(OUTPUT_DIR, "complexity-report.json");
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");
  log(`JSON report written to quality/reports/complexity/complexity-report.json (${total} functions)`);

  // Write standalone HTML
  writeHtmlReport(report);

  // Summary
  log(`Analysis complete: ${total} functions across ${sourceFiles.length} files`);
  log(`  Avg: ${avg.toFixed(1)} | Median: ${median} | Max: ${max}`);
  log(`  LOW: ${distribution.LOW} | MODERATE: ${distribution.MODERATE} | HIGH: ${distribution.HIGH} | VERY HIGH: ${distribution.VERY_HIGH}`);

  return report;
}

// ── HTML report ──────────────────────────────────────────────────────────────

function writeHtmlReport(report) {
  const { summary, functions } = report;
  const top30 = functions.slice(0, 30);
  const now = new Date().toLocaleString("en-US", { timeZone: "UTC", hour12: false });

  const distTotal = summary.totalFunctions || 1;
  const barWidth = (count) => ((count / distTotal) * 100).toFixed(1);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fenrir Ledger — Cyclomatic Complexity Report</title>
<style>
  :root {
    --void: #07070d; --surface: #0f0f16; --surface2: #161620; --hover: #1a1a22;
    --gold: #c9920a; --stone: #8b8680; --dirt: #3a2e22;
    --green: #4ade80; --red: #ef4444; --red-dark: #dc2626; --yellow: #f9cd0b;
    --text: #e8e8e0; --text-dim: #888; --border: #2a2a34;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--void); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; }
  .container { max-width: 960px; margin: 0 auto; padding: 2rem 1.5rem; }
  .header { text-align: center; padding: 2rem 0 1.5rem; border-bottom: 2px solid var(--gold); margin-bottom: 2rem; }
  .header h1 { font-family: 'Cinzel', serif; font-size: 1.6rem; color: var(--gold); letter-spacing: 0.15em; text-transform: uppercase; }
  .header .subtitle { color: var(--stone); font-size: 0.85rem; margin-top: 0.5rem; }
  .header .runes { font-size: 1.2rem; letter-spacing: 0.3em; color: var(--gold); opacity: 0.5; margin-bottom: 0.5rem; }
  .section { margin-bottom: 2.5rem; }
  .section-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border); }
  .section-header h2 { font-family: 'Cinzel', serif; font-size: 1.1rem; color: var(--gold); letter-spacing: 0.08em; }
  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem; text-align: center; }
  .stat-card .value { font-family: 'JetBrains Mono', monospace; font-size: 1.6rem; font-weight: 700; }
  .stat-card .label { font-size: 0.75rem; color: var(--stone); text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.3rem; }
  .stat-card.green .value { color: var(--green); }
  .stat-card.gold .value { color: var(--gold); }
  .stat-card.red .value { color: var(--red); }
  table { width: 100%; border-collapse: collapse; background: var(--surface); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin: 1rem 0; }
  th { background: var(--dirt); color: var(--gold); font-weight: 700; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase; padding: 0.75rem; text-align: left; }
  td { padding: 0.6rem 0.75rem; border-top: 1px solid var(--border); font-size: 0.85rem; }
  tr:hover td { background: var(--hover); }
  .dist-bar { display: flex; align-items: center; gap: 0.75rem; margin: 0.5rem 0; }
  .dist-label { width: 100px; font-size: 0.8rem; font-weight: 600; text-align: right; }
  .dist-track { flex: 1; background: var(--surface2); height: 24px; border-radius: 4px; overflow: hidden; position: relative; }
  .dist-fill { height: 100%; border-radius: 4px; transition: width 0.5s ease; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
  .dist-count { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--text); min-width: 50px; text-align: left; margin-left: 0.5rem; }
  .risk-low { color: var(--green); }
  .risk-mod { color: var(--gold); }
  .risk-high { color: var(--red); }
  .risk-vhigh { color: var(--red-dark); font-weight: 700; }
  .rec { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 1rem 1.25rem; margin: 0.5rem 0; }
  .rec-title { font-weight: 700; font-size: 0.85rem; margin-bottom: 0.3rem; }
  .rec-body { font-size: 0.8rem; color: var(--stone); }
  .footer { text-align: center; padding: 2rem 0; border-top: 1px solid var(--border); margin-top: 2rem; font-size: 0.75rem; color: var(--text-dim); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="runes">\u16A0 \u16D6 \u16BE \u16B1 \u16C1 \u16B1</div>
    <h1>Cyclomatic Complexity Report</h1>
    <div class="subtitle">Generated ${now} UTC &middot; ${report.filesAnalyzed} files analyzed</div>
  </div>

  <div class="section">
    <div class="section-header"><h2>Summary</h2></div>
    <div class="stats-grid">
      <div class="stat-card gold"><div class="value">${summary.totalFunctions}</div><div class="label">Functions</div></div>
      <div class="stat-card ${summary.avgComplexity <= 5 ? 'green' : summary.avgComplexity <= 10 ? 'gold' : 'red'}"><div class="value">${summary.avgComplexity}</div><div class="label">Avg Complexity</div></div>
      <div class="stat-card gold"><div class="value">${summary.medianComplexity}</div><div class="label">Median</div></div>
      <div class="stat-card ${summary.maxComplexity <= 10 ? 'gold' : 'red'}"><div class="value">${summary.maxComplexity}</div><div class="label">Max</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><h2>Distribution</h2></div>
    <div class="dist-bar">
      <div class="dist-label risk-low">LOW (1-5)</div>
      <div class="dist-track"><div class="dist-fill" style="width:${barWidth(summary.distribution.LOW)}%;background:var(--green)"></div></div>
      <div class="dist-count">${summary.distribution.LOW} (${(summary.distribution.LOW / distTotal * 100).toFixed(0)}%)</div>
    </div>
    <div class="dist-bar">
      <div class="dist-label risk-mod">MOD (6-10)</div>
      <div class="dist-track"><div class="dist-fill" style="width:${barWidth(summary.distribution.MODERATE)}%;background:var(--gold)"></div></div>
      <div class="dist-count">${summary.distribution.MODERATE} (${(summary.distribution.MODERATE / distTotal * 100).toFixed(0)}%)</div>
    </div>
    <div class="dist-bar">
      <div class="dist-label risk-high">HIGH (11-20)</div>
      <div class="dist-track"><div class="dist-fill" style="width:${barWidth(summary.distribution.HIGH)}%;background:var(--red)"></div></div>
      <div class="dist-count">${summary.distribution.HIGH} (${(summary.distribution.HIGH / distTotal * 100).toFixed(0)}%)</div>
    </div>
    <div class="dist-bar">
      <div class="dist-label risk-vhigh">CRIT (21+)</div>
      <div class="dist-track"><div class="dist-fill" style="width:${barWidth(summary.distribution.VERY_HIGH)}%;background:var(--red-dark)"></div></div>
      <div class="dist-count">${summary.distribution.VERY_HIGH} (${(summary.distribution.VERY_HIGH / distTotal * 100).toFixed(0)}%)</div>
    </div>
  </div>

  <div class="section">
    <div class="section-header"><h2>Most Complex Functions (Top 30)</h2></div>
    <table>
      <thead><tr><th>#</th><th>Function</th><th>File</th><th>Line</th><th>Complexity</th><th>Risk</th></tr></thead>
      <tbody>
${top30.map((f, i) => {
  const shortFile = f.file.replace("development/ledger/src/", "");
  const cls = f.category === "LOW" ? "risk-low" : f.category === "MODERATE" ? "risk-mod" : f.category === "HIGH" ? "risk-high" : "risk-vhigh";
  return `        <tr>
          <td>${i + 1}</td>
          <td><code>${f.function}</code></td>
          <td><code>${shortFile}</code></td>
          <td>${f.line}</td>
          <td class="${cls}"><strong>${f.complexity}</strong></td>
          <td class="${cls}">${f.category.replace("_", " ")}</td>
        </tr>`;
}).join("\n")}
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-header"><h2>Recommendations</h2></div>
${summary.distribution.VERY_HIGH > 0 ? `    <div class="rec">
      <div class="rec-title risk-vhigh">Critical: ${summary.distribution.VERY_HIGH} function(s) with complexity &gt; 20</div>
      <div class="rec-body">These functions have too many decision paths to test effectively. Break them into smaller, focused functions. Each should have a single responsibility with complexity &le; 10.</div>
    </div>` : ""}
${summary.distribution.HIGH > 0 ? `    <div class="rec">
      <div class="rec-title risk-high">${summary.distribution.HIGH} function(s) with complexity 11&ndash;20</div>
      <div class="rec-body">Review for testability. Consider extracting conditional logic into helper functions or using early returns to reduce nesting depth.</div>
    </div>` : ""}
    <div class="rec">
      <div class="rec-title" style="color:var(--gold)">Overall Health: ${summary.lowPct.toFixed(0)}% of functions are LOW complexity</div>
      <div class="rec-body">${summary.lowPct >= 80 ? "Excellent. The codebase is well-factored with simple, testable functions." : summary.lowPct >= 60 ? "Good, but there is room to simplify. Target the HIGH/VERY HIGH functions first." : "Needs attention. Too many complex functions make testing and maintenance harder."}</div>
    </div>
  </div>

  <div class="footer">
    Generated by <code>quality/scripts/complexity-analysis.mjs</code> &middot;
    <a href="../quality-report.html" style="color:var(--gold)">Quality Report</a> &middot;
    Fenrir Ledger ${new Date().toISOString().split("T")[0]}
  </div>
</div>
</body>
</html>`;

  const htmlPath = path.join(OUTPUT_DIR, "index.html");
  writeFileSync(htmlPath, html, "utf-8");
  log(`HTML report written to quality/reports/complexity/index.html`);
}

const result = main();
export default result;
