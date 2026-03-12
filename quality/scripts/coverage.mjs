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
import { existsSync, mkdirSync, rmSync } from "node:fs";
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
  log("Starting Next.js production server with V8 coverage enabled...");

  // NODE_V8_COVERAGE tells Node.js to write V8 coverage JSON files to this
  // directory when the process exits cleanly. Use node directly (not npx) so
  // SIGTERM reaches the actual Node process for a clean exit + coverage write.
  const nextBin = path.join(FRONTEND_DIR, "node_modules", ".bin", "next");
  const serverProc = spawn(
    "node",
    [nextBin, "start", "-p", "9653"],
    {
      cwd: FRONTEND_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_V8_COVERAGE: V8_COVERAGE_DIR,
        NODE_ENV: "production",
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
    run(`npx ${pwArgs.join(" ")}`, { cwd: FRONTEND_DIR });
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

function generateReports() {
  // When running combined mode, output Playwright reports to playwright/ subdirectory
  // so they don't overwrite Vitest reports and can be merged later
  const reportsDir = combined ? path.join(REPORTS_DIR, "playwright") : REPORTS_DIR;
  mkdirSync(reportsDir, { recursive: true });

  log("Generating Playwright coverage reports via c8...");

  // c8 reads V8 coverage JSON and resolves source maps from .next/server/chunks/
  // back to src/. Do NOT use --all/--src/--include as they prevent source map
  // resolution — the compiled chunks live under .next/ not src/.
  // Instead, exclude non-app code and let source maps handle the mapping.
  const c8Args = [
    "c8", "report",
    "--temp-directory", V8_COVERAGE_DIR,
    "--reporter", "text",
    "--reporter", "text-summary",
    "--reporter", "html",
    "--reporter", "lcov",
    "--reports-dir", reportsDir,
    "--exclude", "node_modules/**",
  ];

  try {
    run(`npx ${c8Args.join(" ")}`, { cwd: FRONTEND_DIR });
  } catch {
    log("c8 report generation had warnings (non-zero exit) — reports may still be valid");
  }

  const relDir = path.relative(REPO_ROOT, reportsDir);
  log(`Reports written to ${reportsDir}`);
  log(`  - HTML:  ${relDir}/index.html`);
  log(`  - LCOV:  ${relDir}/lcov.info`);
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
  log(`Vitest coverage reports written to ${vitestReportsDir}`);
  log("  - HTML:  quality/reports/coverage/vitest/index.html");
  log("  - LCOV:  quality/reports/coverage/vitest/lcov.info");
}

async function main() {
  if (unitOnly) {
    log("Running in --unit-only mode (Vitest coverage only)");
    runUnitCoverage();
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

  // Phase 3: Merge coverage reports
  if (combined) {
    log("Phase 3/3: Merging coverage reports...");
    runCombine();
    log("Done! Combined report: quality/reports/coverage/combined/index.html");
  } else {
    log("Done! Open quality/reports/coverage/index.html to view the report.");
  }

  // Keep intermediate V8 coverage data for inspection (gitignored)
  log("V8 coverage data kept at: quality/.coverage-tmp/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
