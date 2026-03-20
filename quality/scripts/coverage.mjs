#!/usr/bin/env node
/**
 * coverage.mjs — Collect code coverage and generate reports.
 *
 * Usage:
 *   node quality/scripts/coverage.mjs [--unit-only | --e2e-only] [--skip-build] [--skip-tests] [-- playwright args...]
 *
 * Modes:
 *   --unit-only   Vitest coverage only (fast, no browser)
 *   (default)     Vitest + Playwright coverage merged into a single report
 *   --e2e-only    Playwright E2E coverage only (no Vitest)
 *
 * Flow (default / --e2e-only):
 *   1. (default) Run Vitest unit/integration coverage (fast, no server)
 *   2. Build the Next.js app (unless --skip-build)
 *   3. Start the production server with NODE_V8_COVERAGE
 *   4. Run Playwright tests
 *   5. Stop server (SIGTERM triggers V8 coverage write)
 *   6. Use c8 to generate reports from collected V8 data
 *   7. (default) Merge Vitest + Playwright via coverage-combine.mjs
 *
 * Reports are written to: quality/reports/coverage/
 */

import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const FRONTEND_DIR = path.join(REPO_ROOT, "development/frontend");
const REPORTS_DIR = path.join(REPO_ROOT, "quality/reports/coverage");
const V8_COVERAGE_DIR = path.join(REPO_ROOT, "quality/.coverage-tmp");

const args = process.argv.slice(2);
const unitOnly = args.includes("--unit-only");
const combined = unitOnly ? false : !args.includes("--e2e-only"); // default: combined (unless --unit-only or --e2e-only)
const skipBuild = args.includes("--skip-build");
const skipTests = args.includes("--skip-tests");
const dashDashIdx = args.indexOf("--");
const playwrightArgs = dashDashIdx >= 0 ? args.slice(dashDashIdx + 1) : [];

function ts() {
  return new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, "Z");
}
function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function run(cmd, opts = {}) {
  log(`$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function clean() {
  for (const d of [V8_COVERAGE_DIR, REPORTS_DIR]) {
    if (existsSync(d)) rmSync(d, { recursive: true });
  }
  mkdirSync(V8_COVERAGE_DIR, { recursive: true });
  mkdirSync(REPORTS_DIR, { recursive: true });
}

function build() {
  if (skipBuild) {
    log("Skipping build (--skip-build)");
    return;
  }
  log("Building Next.js app...");
  run("npm run build", { cwd: FRONTEND_DIR });
}

function startServer() {
  log("Starting Next.js production server with NODE_V8_COVERAGE...");

  // NODE_V8_COVERAGE is set in the env below. Node.js writes V8 coverage JSON files
  // to V8_COVERAGE_DIR when the process exits cleanly (SIGTERM). c8 then reads
  // those files and follows source maps back to src/ to produce LCOV + HTML.
  //
  // We use `next start` even though next.config.ts has output: "standalone".
  // The standalone server (node .next/standalone/server.js) does not serve
  // .next/static/ or public/ assets without manual copying, causing E2E test
  // failures. `next start` shows a harmless warning but works correctly for
  // coverage collection. The normalizeLcov() step remaps .next/server/app/
  // paths to src/ after c8 generates the LCOV.
  // Use the actual JS entry point, not the shell wrapper in .bin/ — Node.js
  // cannot execute the .bin/next shell script and crashes with SyntaxError.
  const nextBin = path.join(FRONTEND_DIR, "node_modules", "next", "dist", "bin", "next");

  const serverProc = spawn(
    "node",
    [nextBin, "start", "-p", "9653"],
    {
      cwd: FRONTEND_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "production",
        NODE_V8_COVERAGE: V8_COVERAGE_DIR,
      },
    },
  );

  serverProc.stdout.on("data", (d) => process.stdout.write(d));
  serverProc.stderr.on("data", (d) => process.stderr.write(d));

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server did not start within 60s"));
    }, 60_000);

    const check = setInterval(async () => {
      try {
        // Use AbortController to avoid hanging fetch
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 3000);
        const resp = await fetch("http://localhost:9653/ledger/sign-in", {
          signal: controller.signal,
          redirect: "manual", // Don't follow redirects — any response means server is up
        });
        clearTimeout(fetchTimeout);
        // Any response (200, 301, 302, 404, etc.) means server is running
        clearTimeout(timeout);
        clearInterval(check);
        log(`Server is ready on port 9653 (status: ${resp.status})`);
        resolve(serverProc);
      } catch {
        // not ready yet
      }
    }, 1000);

    serverProc.on("error", (err) => {
      clearTimeout(timeout);
      clearInterval(check);
      reject(err);
    });

    serverProc.on("exit", (code) => {
      clearTimeout(timeout);
      clearInterval(check);
      if (code !== null && code !== 0) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });
  });
}

function runTests(extraArgs = []) {
  if (skipTests) {
    log("Skipping tests (--skip-tests)");
    return;
  }
  log("Running Playwright tests...");
  const pwArgs = ["playwright", "test", "--config", "playwright.config.ts", ...extraArgs];
  try {
    // Set SERVER_URL so Playwright skips its own webServer (we already started one).
    run(`npx ${pwArgs.join(" ")}`, {
      cwd: FRONTEND_DIR,
      env: { ...process.env, SERVER_URL: "http://localhost:9653" },
    });
  } catch {
    log("Some tests failed — continuing to generate coverage report from partial data");
  }
}

function stopServer(serverProc) {
  return new Promise((resolve) => {
    log("Stopping server (SIGTERM → triggers V8 coverage write)...");
    serverProc.on("exit", () => {
      log("Server stopped");
      resolve();
    });
    serverProc.kill("SIGTERM");
    // Force kill after 10s if graceful shutdown hangs
    setTimeout(() => {
      if (!serverProc.killed) {
        log("Force killing server (SIGKILL)...");
        serverProc.kill("SIGKILL");
      }
      resolve();
    }, 10_000);
  });
}

/**
 * Resolve a src/-relative path with .js extension to the actual TypeScript extension.
 * Tries .tsx → .ts → .jsx → .js in order, returning the first that exists on disk.
 */
function resolveExtension(srcRelPath, frontendDir) {
  const base = path.join(frontendDir, srcRelPath.replace(/\.js$/, ""));
  for (const ext of [".tsx", ".ts", ".jsx", ".js"]) {
    if (existsSync(base + ext)) return srcRelPath.replace(/\.js$/, ext);
  }
  return srcRelPath; // keep .js if nothing found
}

/**
 * Post-process the Playwright LCOV to remap .next/server/app/ paths → src/app/ paths
 * and drop node_modules entries.
 *
 * c8 captures V8 coverage from compiled .next/server/app/*.js files, which have the
 * same directory structure as src/app/ but with .js extension. By remapping paths here,
 * the combine step can merge Playwright + Vitest coverage for the same source files.
 *
 * Line numbers from compiled .js won't perfectly match .ts source lines (known limitation),
 * but file-level and function-level coverage is accurate.
 */
function normalizeLcov(lcovPath) {
  if (!existsSync(lcovPath)) return;
  const raw = readFileSync(lcovPath, "utf-8");
  const records = raw.split(/(?<=end_of_record)/);
  let kept = 0, dropped = 0, remapped = 0;
  const out = [];

  for (const rec of records) {
    if (!rec.trim()) continue;
    const sfMatch = rec.match(/^SF:(.+)$/m);
    if (!sfMatch) continue;
    const sf = sfMatch[1].trim();

    // Drop node_modules entirely
    if (sf.startsWith("node_modules/")) { dropped++; continue; }

    // Remap .next/server/app/ → src/app/
    if (sf.startsWith(".next/server/app/")) {
      const srcPath = sf.replace(/^\.next\/server\//, "src/");
      const resolved = resolveExtension(srcPath, FRONTEND_DIR);
      // Strip FN/FNA/FNDA lines — their line numbers come from compiled .js, not .ts source.
      // Vitest owns function coverage with correct line numbers. Playwright contributes
      // DA (line hits) and branch data only, avoiding duplicate function definition
      // conflicts when genhtml merges the two LCOVs.
      const stripped = rec
        .replace(/^FN:\d+,.+$/gm, "")
        .replace(/^FNDA:\d+,.+$/gm, "")
        .replace(/^FNA:.+$/gm, "")
        .replace(/^FNF:\d+$/gm, "FNF:0")
        .replace(/^FNH:\d+$/gm, "FNH:0");
      out.push(stripped.replace(/^SF:.+$/m, `SF:${resolved}`));
      remapped++;
      kept++;
      continue;
    }

    // Drop test files — they should never appear in coverage reports.
    if (sf.startsWith("src/__tests__/")) { dropped++; continue; }

    // Keep src/ paths as-is — but strip FN* lines. c8 with --all generates src/
    // entries for all files, but the FN line numbers come from webpack-compiled .js
    // and differ from the TypeScript source. Vitest owns all function coverage with
    // correct line numbers; playwright only contributes DA + branch data.
    if (sf.startsWith("src/")) {
      const stripped = rec
        .replace(/^FN:\d+,.+$/gm, "")
        .replace(/^FNDA:\d+,.+$/gm, "")
        .replace(/^FNA:.+$/gm, "")
        .replace(/^FNF:\d+$/gm, "FNF:0")
        .replace(/^FNH:\d+$/gm, "FNH:0");
      out.push(stripped);
      kept++;
      continue;
    }

    // Drop everything else (.next/server/chunks/, .next/static/, webpack:// etc.)
    dropped++;
  }

  writeFileSync(lcovPath, out.join(""));
  log(`LCOV normalized: ${kept} kept (${remapped} remapped from .next/server/app/), ${dropped} dropped`);
}

function generateReports() {
  // Process V8 server-side coverage written by Node.js when NODE_V8_COVERAGE is set.
  // Node writes coverage-<timestamp>-<pid>-0.json files to V8_COVERAGE_DIR on clean exit.
  // c8 reads these files, follows source maps from .next/server/chunks/ back to src/,
  // and produces LCOV + HTML reports.
  const reportsDir = combined ? path.join(REPORTS_DIR, "playwright") : REPORTS_DIR;
  mkdirSync(reportsDir, { recursive: true });

  // Find V8 coverage files (named coverage-*.json) written by Node.js on SIGTERM exit.
  const v8Files = existsSync(V8_COVERAGE_DIR)
    ? readdirSync(V8_COVERAGE_DIR).filter((f) => /^coverage-.+\.json$/.test(f))
    : [];

  if (v8Files.length === 0) {
    log("No V8 coverage files found in quality/.coverage-tmp/ — server may not have exited cleanly or NODE_V8_COVERAGE was not set");
    log("Creating empty LCOV file so combined merge can proceed...");
    writeFileSync(path.join(reportsDir, "lcov.info"), "");
    return;
  }

  log(`Found ${v8Files.length} V8 coverage file(s) — running c8 report...`);

  const c8Args = [
    "c8", "report",
    "--temp-directory", V8_COVERAGE_DIR,
    "--reporter", "text-summary",
    "--reporter", "html",
    "--reporter", "lcov",
    "--reports-dir", reportsDir,
    "--all",
    "--src", "src",
    "--exclude", "**/*.test.*",
    "--exclude", "**/*.spec.*",
    "--exclude", "**/__tests__/**",
    "--exclude", "**/node_modules/**",
  ];

  try {
    run(`npx ${c8Args.join(" ")}`, { cwd: FRONTEND_DIR });
    const relDir = path.relative(REPO_ROOT, reportsDir);
    log(`Reports written to ${reportsDir}`);
    log(`  - HTML:  ${relDir}/index.html`);
    log(`  - LCOV:  ${relDir}/lcov.info`);
  } catch (err) {
    log(`c8 report generation failed: ${err.message}`);
    // Ensure lcov.info exists so combined merge does not error out
    if (!existsSync(path.join(reportsDir, "lcov.info"))) {
      writeFileSync(path.join(reportsDir, "lcov.info"), "");
    }
  }
}

/**
 * Post-process Istanbul HTML reports (vitest, playwright) to inject Fenrir theme.
 * Istanbul generates reports with base.css — we copy our coverage.css alongside
 * and inject a <link> after base.css in every HTML file.
 */
function applyFenrirTheme(reportDir) {
  const cssSource = path.join(__dirname, "coverage.css");
  if (!existsSync(cssSource) || !existsSync(reportDir)) return;

  // Copy CSS to the report directory
  copyFileSync(cssSource, path.join(reportDir, "fenrir-theme.css"));

  // Walk all HTML files and inject the link
  function walkAndInject(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkAndInject(fullPath);
      } else if (entry.name.endsWith(".html")) {
        let html = readFileSync(fullPath, "utf8");
        if (html.includes("fenrir-theme.css")) continue; // already injected

        // Compute relative path to the report root where fenrir-theme.css lives
        const relToRoot = path.relative(dir, reportDir).replace(/\\/g, "/");
        const cssHref = relToRoot ? `${relToRoot}/fenrir-theme.css` : "fenrir-theme.css";

        // Inject after base.css link (Istanbul pattern)
        if (html.includes('href="base.css"')) {
          html = html.replace(
            /(<link[^>]*href="[^"]*base\.css"[^>]*>)/,
            `$1\n    <link rel="stylesheet" href="${cssHref}" />`,
          );
        } else {
          // Fallback: inject before </head>
          html = html.replace(
            "</head>",
            `    <link rel="stylesheet" href="${cssHref}" />\n</head>`,
          );
        }
        writeFileSync(fullPath, html);
      }
    }
  }

  walkAndInject(reportDir);
  log(`Fenrir theme applied to ${path.relative(REPO_ROOT, reportDir)}`);
}

function runCombine() {
  log("Merging Vitest + Playwright coverage via coverage-combine.mjs...");
  const combineScript = path.join(__dirname, "coverage-combine.mjs");
  try {
    run(`node "${combineScript}"`, { cwd: REPO_ROOT });
  } catch {
    log("Coverage combine had warnings — combined report may still be valid");
  }
}

function ensureDeps() {
  log("Ensuring coverage dependencies are installed...");
  const nodeModules = path.join(FRONTEND_DIR, "node_modules");
  const rollupNative = path.join(nodeModules, "@rollup/rollup-darwin-arm64");
  const coverageV8 = path.join(nodeModules, "@vitest/coverage-v8");

  // If rollup native module is missing, nuke and reinstall (npm optional dep bug)
  if (!existsSync(rollupNative) && existsSync(nodeModules)) {
    log("Rollup native module missing — running clean reinstall...");
    rmSync(nodeModules, { recursive: true });
    run("npm ci", { cwd: FRONTEND_DIR });
    return;
  }

  // If @vitest/coverage-v8 is missing, install it
  if (!existsSync(coverageV8)) {
    log("@vitest/coverage-v8 missing — installing...");
    run("npm install --save-dev @vitest/coverage-v8", { cwd: FRONTEND_DIR });
    // Verify rollup didn't break
    if (!existsSync(rollupNative)) {
      log("Rollup native module broken after install — clean reinstall...");
      rmSync(nodeModules, { recursive: true });
      run("npm i", { cwd: FRONTEND_DIR });
    }
  }
}

function runUnitCoverage() {
  clean();
  ensureDeps();
  log("Running Vitest unit tests with V8 coverage...");
  const vitestReportsDir = path.join(REPORTS_DIR, "vitest");
  mkdirSync(vitestReportsDir, { recursive: true });
  run("npm run test:unit:coverage", { cwd: FRONTEND_DIR });
  applyFenrirTheme(vitestReportsDir);
  log(`Vitest coverage reports written to ${vitestReportsDir}`);
  log("  - HTML:  quality/reports/coverage/vitest/index.html");
  log("  - LCOV:  quality/reports/coverage/vitest/lcov.info");
}

function cleanReports() {
  const reportsRoot = path.join(REPO_ROOT, "quality/reports");
  const toDelete = [
    "test-report-playwright",
    "test-report-vitest",
    "quality-report.html",
    "cull-list.json",
    "coverage",
  ];
  for (const name of toDelete) {
    const target = path.join(reportsRoot, name);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }
  log("Cleaned previous reports");
}

async function main() {
  cleanReports();

  if (unitOnly) {
    log("Running in --unit-only mode (Vitest coverage only)");
    runUnitCoverage();
    log("Generating quality report...");
    const qualityScript = path.join(__dirname, "quality-report-html.mjs");
    try {
      run(`node "${qualityScript}"`, { cwd: REPO_ROOT });
    } catch {
      log("Quality report generation had warnings");
    }
    log("Done! Open quality/reports/coverage/vitest/index.html to view the report.");
    return;
  }

  if (combined) {
    log("Running in --combined mode (Vitest + Playwright → merged report)");
  }

  let serverProc;
  try {
    clean();
    ensureDeps();

    // In combined mode, run Vitest coverage first (fast, no server needed)
    if (combined) {
      log("Phase 1/3: Vitest unit/integration coverage...");
      const vitestReportsDir = path.join(REPORTS_DIR, "vitest");
      mkdirSync(vitestReportsDir, { recursive: true });
      run("npm run test:unit:coverage", { cwd: FRONTEND_DIR });
      applyFenrirTheme(vitestReportsDir);
      log("Vitest coverage complete.");
    }

    // Phase 2: Playwright E2E coverage
    if (combined) log("Phase 2/3: Playwright E2E coverage...");
    build();
    serverProc = await startServer();
    runTests(playwrightArgs);
  } catch (err) {
    log(`Error: ${err.message}`);
  }

  if (serverProc) {
    await stopServer(serverProc);
    // Brief pause to let V8 finish writing coverage files
    await new Promise((r) => setTimeout(r, 2000));
  }

  generateReports();
  normalizeLcov(path.join(REPORTS_DIR, "playwright/lcov.info"));
  applyFenrirTheme(path.join(REPORTS_DIR, "playwright"));

  // Phase 3: Merge coverage reports
  if (combined) {
    log("Phase 3/3: Merging coverage reports...");
    runCombine();
  }

  // Generate master index page
  log("Generating master coverage index...");
  const indexScript = path.join(__dirname, "coverage-index.mjs");
  try {
    run(`node "${indexScript}"`, { cwd: REPO_ROOT });
  } catch {
    log("Index generation had warnings — master index may still be valid");
  }

  // Generate quality report
  log("Generating quality report...");
  const qualityScript = path.join(__dirname, "quality-report-html.mjs");
  try {
    run(`node "${qualityScript}"`, { cwd: REPO_ROOT });
  } catch {
    log("Quality report generation had warnings — report may still be valid");
  }

  log("Done! Open quality/reports/coverage/index.html to view all reports.");

  // Keep intermediate V8 coverage data for inspection (gitignored)
  log("V8 coverage data kept at: quality/.coverage-tmp/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
