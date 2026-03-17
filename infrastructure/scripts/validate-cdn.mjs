#!/usr/bin/env node
/**
 * validate-cdn.mjs — CDN edge serving validation for Fenrir Ledger
 *
 * Checks that Cloud CDN is serving correctly by inspecting the
 * `x-goog-cache-status` response header for a set of test URLs.
 *
 * Expected behaviour:
 *   - HTML pages        → HIT (after first warm request)
 *   - Static JS/CSS     → HIT
 *   - API routes        → MISS or no cache header (uncacheable)
 *
 * Usage:
 *   node infrastructure/scripts/validate-cdn.mjs [--base-url https://fenrirledger.com]
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

// --------------------------------------------------------------------------
// Configuration
// --------------------------------------------------------------------------

const DEFAULT_BASE_URL = "https://fenrirledger.com";

/** x-goog-cache-status values that indicate a CDN cache hit. */
const HIT_VALUES = new Set(["HIT", "REVALIDATED", "STALE"]);

/**
 * @typedef {"HIT" | "MISS" | "UNCACHEABLE"} ExpectedCache
 *
 * @typedef {Object} CheckSpec
 * @property {string}        path          - URL path relative to base URL
 * @property {ExpectedCache} expected      - Required cache behaviour
 * @property {string}        description   - Human-readable label for output
 */

/** @type {CheckSpec[]} */
const CHECKS = [
  {
    path: "/",
    expected: "HIT",
    description: "Homepage HTML — should be cached after warm request",
  },
  {
    // Next.js emits a build-ID-stamped manifest; any static chunk works.
    // The path does not need to exist on disk — CDN serves from GCS/origin.
    path: "/_next/static/chunks/main.js",
    expected: "HIT",
    description: "Static JS chunk — should always be cached",
  },
  {
    path: "/_next/static/css/app.css",
    expected: "HIT",
    description: "Static CSS — should always be cached",
  },
  {
    path: "/api/health",
    expected: "UNCACHEABLE",
    description: "API health endpoint — must NOT be cached",
  },
  {
    path: "/api/auth/token",
    expected: "UNCACHEABLE",
    description: "Auth token endpoint — must NOT be cached",
  },
];

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

/**
 * Parse CLI args for --base-url flag.
 * @returns {string}
 */
function resolveBaseUrl() {
  const idx = process.argv.indexOf("--base-url");
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].replace(/\/$/, "");
  }
  return DEFAULT_BASE_URL;
}

/**
 * Classify a raw x-goog-cache-status header value.
 * @param {string | null} raw
 * @returns {ExpectedCache}
 */
function classify(raw) {
  if (!raw) return "UNCACHEABLE";
  const upper = raw.toUpperCase();
  return HIT_VALUES.has(upper) ? "HIT" : upper === "MISS" ? "MISS" : "UNCACHEABLE";
}

/**
 * Fetch a URL with a warm-up request followed by the validation request.
 * We do two requests so HTML pages get a chance to be cached on first load.
 *
 * @param {string} url
 * @returns {Promise<{status: number, cacheHeader: string | null, classification: ExpectedCache}>}
 */
async function probe(url) {
  const opts = {
    method: "GET",
    redirect: "follow",
    headers: { "User-Agent": "fenrir-cdn-validator/1.0" },
  };

  // Warm-up — prime the CDN cache
  await fetch(url, opts).catch(() => null);

  // Validation request
  const res = await fetch(url, opts);
  const cacheHeader = res.headers.get("x-goog-cache-status");

  return {
    status: res.status,
    cacheHeader,
    classification: classify(cacheHeader),
  };
}

/**
 * Check whether the actual classification satisfies the expectation.
 * UNCACHEABLE expectation accepts MISS or absent header (both mean no caching).
 *
 * @param {ExpectedCache} expected
 * @param {ExpectedCache} actual
 * @returns {boolean}
 */
function passes(expected, actual) {
  if (expected === "UNCACHEABLE") return actual === "UNCACHEABLE" || actual === "MISS";
  if (expected === "HIT") return actual === "HIT";
  if (expected === "MISS") return actual === "MISS";
  return false;
}

// --------------------------------------------------------------------------
// Runner
// --------------------------------------------------------------------------

async function main() {
  const baseUrl = resolveBaseUrl();
  console.log(`\nFenrir CDN Validation — target: ${baseUrl}\n`);
  console.log("=".repeat(60));

  let failures = 0;

  for (const check of CHECKS) {
    const url = `${baseUrl}${check.path}`;
    process.stdout.write(`  Checking ${check.path} … `);

    let result;
    try {
      result = await probe(url);
    } catch (/** @type {unknown} */ err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`ERROR — ${msg}`);
      failures++;
      continue;
    }

    const ok = passes(check.expected, result.classification);
    const icon = ok ? "✓" : "✗";
    const raw = result.cacheHeader ?? "(none)";
    const label = ok ? "PASS" : "FAIL";

    console.log(
      `${icon} ${label} [HTTP ${result.status}] ` +
        `x-goog-cache-status: ${raw} (expected: ${check.expected}, got: ${result.classification})`
    );

    if (!ok) {
      console.log(`    └─ ${check.description}`);
      failures++;
    }
  }

  console.log("=".repeat(60));

  if (failures === 0) {
    console.log(`\n✓ All ${CHECKS.length} CDN checks passed.\n`);
    process.exit(0);
  } else {
    console.error(`\n✗ ${failures} of ${CHECKS.length} CDN checks failed.\n`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
