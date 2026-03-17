import { NextRequest, NextResponse } from "next/server";
import { requireAuthz } from "@/lib/auth/authz";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/config/picker called");

  // Verify caller is authenticated and has Karl tier or active trial (ADR-015, #559, #982)
  const authz = await requireAuthz(request, { tier: "karl-or-trial" });
  if (!authz.ok) {
    log.debug("GET /api/config/picker returning", { reason: "authz failed" });
    return authz.response;
  }

  const pickerApiKey = process.env.GOOGLE_PICKER_API_KEY;
  if (!pickerApiKey) {
    log.debug("GET /api/config/picker returning", { status: 500, error: "not_configured" });
    return NextResponse.json(
      { error: "not_configured", error_description: "Google Picker API key is not configured." },
      { status: 500 },
    );
  }

  log.debug("GET /api/config/picker returning", { status: 200, hasKey: true });
  return NextResponse.json({ pickerApiKey }, {
    headers: { "Cache-Control": "no-store" },
  });
}
