/**
 * GET /api/openapi
 *
 * Serves the Fenrir Ledger OpenAPI 3.1.0 specification as JSON.
 * Auth-gated: requires a valid Bearer id_token.
 *
 * Consumed by the Scalar API explorer at /openapi-ui/.
 *
 * Issue #2057
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { openApiSpec } from "@/lib/openapi/spec";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(openApiSpec, {
    headers: { "Cache-Control": "no-store" },
  });
}
