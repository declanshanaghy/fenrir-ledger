import { NextRequest, NextResponse } from "next/server";
import type { SheetImportError } from "@/lib/sheets/types";
import { importFromSheet } from "@/lib/sheets/import-pipeline";
import { importFromCsv } from "@/lib/sheets/csv-import-pipeline";
import { requireAuth } from "@/lib/auth/require-auth";

export const maxDuration = 60;

function errorResponse(code: SheetImportError["code"], message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: { code, message } satisfies SheetImportError }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify caller is authenticated (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  let url: string | undefined;
  let csv: string | undefined;

  try {
    const body = await request.json();
    url = body?.url;
    csv = body?.csv;
  } catch {
    return errorResponse("INVALID_URL", "Invalid JSON body.");
  }

  // Exactly one of url or csv must be provided
  const hasUrl = url && typeof url === "string";
  const hasCsv = csv && typeof csv === "string";

  if (hasUrl && hasCsv) {
    return errorResponse("INVALID_URL", "Provide either 'url' or 'csv', not both.");
  }

  if (!hasUrl && !hasCsv) {
    return errorResponse("INVALID_URL", "Request body must include a 'url' or 'csv' string.");
  }

  // Run the appropriate import pipeline
  try {
    const result = hasUrl
      ? await importFromSheet(url!)
      : await importFromCsv(csv!);

    if ("error" in result) {
      const status = result.error.code === "INVALID_URL" ? 400
        : result.error.code === "INVALID_CSV" ? 400
        : result.error.code === "SHEET_NOT_PUBLIC" ? 403
        : result.error.code === "NO_CARDS_FOUND" ? 404
        : 500;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result);
  } catch {
    return errorResponse(
      "FETCH_ERROR",
      "The import service encountered an unexpected error. Please try again.",
      500
    );
  }
}
