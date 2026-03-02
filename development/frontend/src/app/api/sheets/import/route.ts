import { NextRequest, NextResponse } from "next/server";
import type { SheetImportError } from "@/lib/sheets/types";
import { importFromSheet } from "@/lib/sheets/import-pipeline";

export const maxDuration = 60;

const IMPORT_MODE = process.env.IMPORT_MODE || "serverless";
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:9753";

function errorResponse(code: SheetImportError["code"], message: string, status: number = 400): NextResponse {
  return NextResponse.json({ error: { code, message } satisfies SheetImportError }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let url: string;
  try {
    const body = await request.json();
    url = body?.url;
    if (!url || typeof url !== "string") {
      return errorResponse("INVALID_URL", "Request body must include a 'url' string.");
    }
  } catch {
    return errorResponse("INVALID_URL", "Invalid JSON body.");
  }

  if (IMPORT_MODE === "backend") {
    // Proxy to the dedicated backend server
    try {
      const upstream = await fetch(`${BACKEND_URL}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(55_000),
      });

      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        return errorResponse("FETCH_ERROR", "Import timed out. The backend server may be overloaded.", 504);
      }
      return errorResponse(
        "FETCH_ERROR",
        "The import service is currently unavailable. Please try again later.",
        503
      );
    }
  }

  // Serverless mode (default) — run the pipeline inline
  try {
    const result = await importFromSheet(url);

    if ("error" in result) {
      const status = result.error.code === "INVALID_URL" ? 400
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
