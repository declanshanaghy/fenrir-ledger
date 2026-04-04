/**
 * GET /api/openapi.json
 *
 * Serves the Fenrir Ledger OpenAPI 3.1.0 specification as JSON.
 * Public endpoint — no auth required.
 *
 * Accessible at /openapi.json via rewrite rule in next.config.ts.
 *
 * Issue #2009
 */

import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi/spec";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "Content-Type": "application/json",
    },
  });
}
