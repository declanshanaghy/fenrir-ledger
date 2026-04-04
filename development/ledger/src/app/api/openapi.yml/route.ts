/**
 * GET /api/openapi.yml
 *
 * Serves the Fenrir Ledger OpenAPI 3.1.0 specification as YAML.
 * Public endpoint — no auth required. YAML is preferred by many tooling consumers.
 *
 * Accessible at /openapi.yml via rewrite rule in next.config.ts.
 *
 * Issue #2009
 */

import { NextResponse } from "next/server";
import { stringify } from "yaml";
import { openApiSpec } from "@/lib/openapi/spec";

export async function GET(): Promise<NextResponse> {
  const yamlBody = stringify(openApiSpec, { lineWidth: 0 });

  return new NextResponse(yamlBody, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/yaml; charset=utf-8",
    },
  });
}
