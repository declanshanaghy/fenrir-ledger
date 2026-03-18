/**
 * Babel config for Istanbul build-time instrumentation.
 *
 * Only used when building with ISTANBUL_COVERAGE=1. Next.js will use this
 * instead of SWC, which enables babel-plugin-istanbul to instrument all
 * source files with coverage counters. The instrumented code writes to
 * window.__coverage__ at runtime.
 *
 * Usage:
 *   ISTANBUL_COVERAGE=1 npm run build
 *
 * Normal builds (without the env var) use SWC — this file is ignored.
 */
module.exports = {
  presets: ["next/babel"],
  plugins: [
    [
      "istanbul",
      {
        exclude: [
          "node_modules/**",
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.spec.ts",
          "**/__tests__/**",
          "**/test-utils/**",
          "**/*.d.ts",
        ],
      },
    ],
  ],
};
