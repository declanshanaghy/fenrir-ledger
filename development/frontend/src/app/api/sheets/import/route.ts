import { NextRequest, NextResponse } from "next/server";
import type { SheetImportError } from "@/lib/sheets/types";

export const maxDuration = 60;

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

  try {
    const upstream = await fetch(`${BACKEND_URL}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(55_000), // Leave 5s buffer before maxDuration
    });

    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (err) {
    // Backend unreachable — return 503
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
