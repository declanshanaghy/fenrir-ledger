/**
 * lcov-filter.loki.test.ts
 *
 * Validates that coverage-combine.mjs filterLcov() correctly excludes
 * src/__tests__/ records, .next/ artifacts, and node_modules from LCOV output.
 *
 * Issue #1397: test files were inflating file counts and skewing coverage % downward.
 */

import { filterLcov, EXCLUDE_PREFIXES } from "../../../../../quality/scripts/coverage-combine.mjs";

// Synthetic LCOV helpers — create minimal valid LCOV records for testing
function makeLcovRecord(sfPath: string, lines = 1): string {
  return `SF:${sfPath}\nDA:1,${lines}\nLH:${lines}\nLF:${lines}\nend_of_record`;
}

function makeLcov(...records: string[]): string {
  return records.join("\n");
}

describe("EXCLUDE_PREFIXES — coverage-combine.mjs", () => {
  it("includes src/__tests__/ in the exclusion list", () => {
    expect(EXCLUDE_PREFIXES).toContain("src/__tests__/");
  });

  it("includes .next/ in the exclusion list", () => {
    expect(EXCLUDE_PREFIXES).toContain(".next/");
  });

  it("includes node_modules/ in the exclusion list", () => {
    expect(EXCLUDE_PREFIXES).toContain("node_modules/");
  });
});

describe("filterLcov — src/__tests__/ exclusion (issue #1397)", () => {
  it("drops a record whose SF path starts with src/__tests__/", () => {
    const lcov = makeLcov(makeLcovRecord("src/__tests__/setup.ts"));
    const { lcov: out, kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(0);
    expect(dropped).toBe(1);
    expect(out).not.toContain("src/__tests__/setup.ts");
  });

  it("drops nested test files under src/__tests__/", () => {
    const lcov = makeLcov(
      makeLcovRecord("src/__tests__/api/auth.test.ts"),
      makeLcovRecord("src/__tests__/hooks/use-entitlement.test.ts"),
      makeLcovRecord("src/__tests__/components/card.test.tsx"),
    );
    const { kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(0);
    expect(dropped).toBe(3);
  });

  it("keeps regular src/ source files", () => {
    const lcov = makeLcov(
      makeLcovRecord("src/app/ledger/page.tsx"),
      makeLcovRecord("src/lib/card-utils.ts"),
      makeLcovRecord("src/components/ui/button.tsx"),
    );
    const { kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(3);
    expect(dropped).toBe(0);
  });

  it("keeps src/ files while dropping src/__tests__/ in the same LCOV", () => {
    const lcov = makeLcov(
      makeLcovRecord("src/lib/gleipnir-utils.ts"),
      makeLcovRecord("src/__tests__/gleipnir-utils.test.ts"),
      makeLcovRecord("src/hooks/use-entitlement.ts"),
      makeLcovRecord("src/__tests__/hooks/use-entitlement.test.tsx"),
    );
    const { lcov: out, kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(2);
    expect(dropped).toBe(2);
    expect(out).toContain("src/lib/gleipnir-utils.ts");
    expect(out).toContain("src/hooks/use-entitlement.ts");
    expect(out).not.toContain("src/__tests__/gleipnir-utils.test.ts");
    expect(out).not.toContain("src/__tests__/hooks/use-entitlement.test.tsx");
  });

  it("drops .next/ artifact records", () => {
    const lcov = makeLcov(makeLcovRecord(".next/server/app/api/route.js"));
    const { kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(0);
    expect(dropped).toBe(1);
  });

  it("drops node_modules records", () => {
    const lcov = makeLcov(makeLcovRecord("node_modules/some-lib/index.js"));
    const { kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(0);
    expect(dropped).toBe(1);
  });

  it("returns kept + dropped counts accurately for mixed content", () => {
    const lcov = makeLcov(
      makeLcovRecord("src/app/page.tsx"),
      makeLcovRecord("src/__tests__/setup.ts"),
      makeLcovRecord(".next/server/chunks/1234.js"),
      makeLcovRecord("node_modules/react/index.js"),
      makeLcovRecord("src/lib/utils.ts"),
    );
    const { kept, dropped } = filterLcov(lcov);
    expect(kept).toBe(2);   // src/app/page.tsx + src/lib/utils.ts
    expect(dropped).toBe(3); // __tests__/ + .next/ + node_modules/
  });

  it("returns valid LCOV with end_of_record markers for kept records", () => {
    const lcov = makeLcov(
      makeLcovRecord("src/app/page.tsx"),
      makeLcovRecord("src/__tests__/page.test.tsx"),
    );
    const { lcov: out } = filterLcov(lcov);
    // Kept record must end with end_of_record
    expect(out).toContain("end_of_record");
    expect(out).toContain("src/app/page.tsx");
    expect(out).not.toContain("src/__tests__/");
  });

  it("handles empty LCOV gracefully", () => {
    const { lcov: out, kept, dropped } = filterLcov("");
    expect(kept).toBe(0);
    expect(dropped).toBe(0);
    expect(out).toBe("");
  });
});
