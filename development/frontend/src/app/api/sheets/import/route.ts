import { NextRequest, NextResponse } from "next/server";
import type { SheetImportError } from "@/lib/sheets/types";
import { importFromSheet } from "@/lib/sheets/import-pipeline";
import { importFromCsv } from "@/lib/sheets/csv-import-pipeline";
import { importFromFile } from "@/lib/sheets/file-import-pipeline";
import { requireAuth } from "@/lib/auth/require-auth";
import { requireKarlOrTrial } from "@/lib/auth/require-karl-or-trial";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { FileFormat } from "@/components/sheets/CsvUpload";

export const maxDuration = 60;

const VALID_FILE_FORMATS: FileFormat[] = ["xls", "xlsx"];

function errorResponse(code: SheetImportError["code"], message: string, status: number = 400): NextResponse {
  log.debug("errorResponse called", { code, status });
  return NextResponse.json({ error: { code, message } satisfies SheetImportError }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/sheets/import called");

  // Verify caller is authenticated (ADR-008)
  const auth = await requireAuth(request);
  if (!auth.ok) {
    log.debug("POST /api/sheets/import returning", { status: 401, reason: "auth failed" });
    return auth.response;
  }

  // Verify caller has Karl tier subscription or active trial (#892)
  const karlOrTrial = await requireKarlOrTrial(auth.user, request);
  if (!karlOrTrial.ok) {
    log.debug("POST /api/sheets/import returning", { status: 402, reason: "karl or trial required" });
    return karlOrTrial.response;
  }

  // Apply per-user rate limiting: 5 uploads per hour (GHSA-4r6h, GHSA-5pgg)
  const rateLimitKey = `sheets:import:${auth.user.sub}`;
  const { success, remaining } = rateLimit(rateLimitKey, {
    limit: 5,
    windowMs: 3_600_000, // 1 hour
  });

  if (!success) {
    log.debug("POST /api/sheets/import returning", { status: 429, reason: "rate limit exceeded" });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" as const, message: "You have exceeded the maximum number of uploads per hour. Please try again later." } satisfies SheetImportError },
      { status: 429 }
    );
  }

  log.debug("POST /api/sheets/import rate limit check passed", { remaining });

  let url: string | undefined;
  let csv: string | undefined;
  let file: string | undefined;
  let filename: string | undefined;
  let format: string | undefined;

  try {
    const body = await request.json();
    url = body?.url;
    csv = body?.csv;
    file = body?.file;
    filename = body?.filename;
    format = body?.format;
  } catch {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "invalid JSON" });
    return errorResponse("INVALID_URL", "Invalid JSON body.");
  }

  // Determine which mode we're in
  const hasUrl = url && typeof url === "string";
  const hasCsv = csv && typeof csv === "string";
  const hasFile = file && typeof file === "string" && filename && typeof filename === "string";

  const modeCount = [hasUrl, hasCsv, hasFile].filter(Boolean).length;
  log.debug("POST /api/sheets/import parsed body", { hasUrl, hasCsv, hasFile, csvLength: csv?.length, format });

  if (modeCount > 1) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "multiple modes" });
    return errorResponse("INVALID_URL", "Provide exactly one of 'url', 'csv', or 'file'.");
  }

  if (modeCount === 0) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "no mode provided" });
    return errorResponse("INVALID_URL", "Request body must include a 'url', 'csv', or 'file' field.");
  }

  // Validate file format when using file upload
  if (hasFile && (!format || !VALID_FILE_FORMATS.includes(format as FileFormat))) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_CSV", reason: "invalid file format", format });
    return errorResponse("INVALID_CSV", `Unsupported file format '${format}'. Accepted: ${VALID_FILE_FORMATS.join(", ")}.`);
  }

  // Run the appropriate import pipeline
  try {
    const mode = hasUrl ? "url" : hasCsv ? "csv" : "file";
    log.debug("POST /api/sheets/import running pipeline", { mode, format });
    const result = hasUrl
      ? await importFromSheet(url!)
      : hasCsv
        ? await importFromCsv(csv!)
        : await importFromFile(file!, filename!, format as FileFormat);

    if ("error" in result) {
      const status = result.error.code === "INVALID_URL" ? 400
        : result.error.code === "INVALID_CSV" ? 400
        : result.error.code === "SHEET_NOT_PUBLIC" ? 403
        : result.error.code === "NO_CARDS_FOUND" ? 404
        : 500;
      log.debug("POST /api/sheets/import returning", { status, errorCode: result.error.code });
      return NextResponse.json(result, { status });
    }

    log.debug("POST /api/sheets/import returning", { status: 200, cardCount: result.cards.length, hasWarning: !!("warning" in result) });
    return NextResponse.json(result);
  } catch (err) {
    log.error("POST /api/sheets/import: pipeline failed", err);
    return errorResponse(
      "FETCH_ERROR",
      "The import service encountered an unexpected error. Please try again.",
      500
    );
  }
}
