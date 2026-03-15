import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireKarlOrTrial } from "@/lib/auth/require-karl-or-trial";
import { log } from "@/lib/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  log.debug("GET /api/config/picker called");

  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("GET /api/config/picker returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  // Verify caller has Karl tier subscription or active trial (#559, #982)
  const karl = await requireKarlOrTrial(auth.user, request);
  if (!karl.ok) {
    log.debug("GET /api/config/picker returning", { status: 402, reason: "karl or trial required" });
    return karl.response;
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
