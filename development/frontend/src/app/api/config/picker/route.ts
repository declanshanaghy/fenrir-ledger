import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/require-auth";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const pickerApiKey = process.env.GOOGLE_PICKER_API_KEY;
  if (!pickerApiKey) {
    return NextResponse.json(
      { error: "not_configured", error_description: "Google Picker API key is not configured." },
      { status: 500 },
    );
  }

  return NextResponse.json({ pickerApiKey });
}
