import { NextRequest, NextResponse } from "next/server";
import type { SheetImportErrorCode, SheetImportResponse } from "@/lib/sheets/types";
import type { SheetImportError } from "@/lib/sheets/types";
import { importFromSheet } from "@/lib/sheets/import-pipeline";
import { importFromCsv } from "@/lib/sheets/csv-import-pipeline";
import { importFromFile } from "@/lib/sheets/file-import-pipeline";
import { validateImportUrl } from "@/lib/sheets/url-validation";
import { requireAuthz } from "@/lib/auth/authz";
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import type { FileFormat } from "@/components/sheets/CsvUpload";

export const maxDuration = 60;

const VALID_FILE_FORMATS: FileFormat[] = ["xls", "xlsx"];

const ERROR_CODE_STATUS: Partial<Record<SheetImportErrorCode, number>> = {
  INVALID_URL: 400,
  INVALID_CSV: 400,
  SHEET_NOT_PUBLIC: 403,
  NO_CARDS_FOUND: 404,
};

function errorResponse(code: SheetImportError["code"], message: string, status = 400): NextResponse {
  log.debug("errorResponse called", { code, status });
  return NextResponse.json({ error: { code, message } satisfies SheetImportError }, { status });
}

function errorCodeToStatus(code: SheetImportErrorCode): number {
  return ERROR_CODE_STATUS[code] ?? 500;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

// ── Body parsing ─────────────────────────────────────────────────────────────

type ParsedBody = {
  url?: unknown;
  csv?: unknown;
  file?: unknown;
  filename?: unknown;
  format?: unknown;
};

type ParseBodyResult =
  | { ok: true; body: ParsedBody }
  | { ok: false; response: NextResponse };

async function parseBody(request: NextRequest): Promise<ParseBodyResult> {
  try {
    const raw = await request.json();
    return { ok: true, body: (raw ?? {}) as ParsedBody };
  } catch {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "invalid JSON" });
    return { ok: false, response: errorResponse("INVALID_URL", "Invalid JSON body.") };
  }
}

// ── Mode validation ───────────────────────────────────────────────────────────

type ImportMode = "url" | "csv" | "file";

type ValidatedMode =
  | { ok: true; mode: ImportMode; url: string; csv: string; file: string; filename: string; format: string }
  | { ok: false; response: NextResponse };

function validateMode(body: ParsedBody): ValidatedMode {
  const hasUrl = isNonEmptyString(body.url);
  const hasCsv = isNonEmptyString(body.csv);
  const hasFile = isNonEmptyString(body.file) && isNonEmptyString(body.filename);

  const modeCount = [hasUrl, hasCsv, hasFile].filter(Boolean).length;
  log.debug("POST /api/sheets/import parsed body", {
    hasUrl, hasCsv, hasFile,
    csvLength: isNonEmptyString(body.csv) ? body.csv.length : 0,
    format: body.format,
  });

  if (modeCount > 1) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "multiple modes" });
    return { ok: false, response: errorResponse("INVALID_URL", "Provide exactly one of 'url', 'csv', or 'file'.") };
  }

  if (modeCount === 0) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_URL", reason: "no mode provided" });
    return { ok: false, response: errorResponse("INVALID_URL", "Request body must include a 'url', 'csv', or 'file' field.") };
  }

  if (hasFile && (!isNonEmptyString(body.format) || !VALID_FILE_FORMATS.includes(body.format as FileFormat))) {
    log.debug("POST /api/sheets/import returning", { status: 400, error: "INVALID_CSV", reason: "invalid file format", format: body.format });
    return { ok: false, response: errorResponse("INVALID_CSV", `Unsupported file format '${String(body.format)}'. Accepted: ${VALID_FILE_FORMATS.join(", ")}.`) };
  }

  const mode: ImportMode = hasUrl ? "url" : hasCsv ? "csv" : "file";
  return {
    ok: true,
    mode,
    url: isNonEmptyString(body.url) ? body.url : "",
    csv: isNonEmptyString(body.csv) ? body.csv : "",
    file: hasFile && isNonEmptyString(body.file) ? body.file : "",
    filename: hasFile && isNonEmptyString(body.filename) ? body.filename : "",
    format: isNonEmptyString(body.format) ? body.format : "",
  };
}

// ── Pipeline dispatch ─────────────────────────────────────────────────────────

async function runPipeline(validated: ValidatedMode & { ok: true }): Promise<SheetImportResponse> {
  const { mode, url, csv, file, filename, format } = validated;
  log.debug("POST /api/sheets/import running pipeline", { mode, format });
  if (mode === "url") return importFromSheet(url);
  if (mode === "csv") return importFromCsv(csv);
  return importFromFile(file, filename, format as FileFormat);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  log.debug("POST /api/sheets/import called");

  // Verify caller is authenticated and has Karl tier or active trial (ADR-015)
  const authz = await requireAuthz(request, { tier: "karl-or-trial" });
  if (!authz.ok) {
    log.debug("POST /api/sheets/import returning", { reason: "authz failed" });
    return authz.response;
  }

  // Apply per-user rate limiting: 5 uploads per hour (GHSA-4r6h, GHSA-5pgg)
  const rateLimitKey = `sheets:import:${authz.user.sub}`;
  const { success, remaining } = rateLimit(rateLimitKey, { limit: 5, windowMs: 3_600_000 });
  if (!success) {
    log.debug("POST /api/sheets/import returning", { status: 429, reason: "rate limit exceeded" });
    return NextResponse.json(
      { error: { code: "RATE_LIMITED" as const, message: "You have exceeded the maximum number of uploads per hour. Please try again later." } satisfies SheetImportError },
      { status: 429 }
    );
  }
  log.debug("POST /api/sheets/import rate limit check passed", { remaining });

  const parsed = await parseBody(request);
  if (!parsed.ok) return parsed.response;

  const validated = validateMode(parsed.body);
  if (!validated.ok) return validated.response;

  // SSRF prevention: validate URL before passing to the pipeline (MEDIUM-002 / #1891)
  if (validated.mode === "url") {
    const urlError = validateImportUrl(validated.url);
    if (urlError) {
      log.warn("POST /api/sheets/import: rejected URL — SSRF prevention", { reason: urlError });
      return errorResponse("INVALID_URL", urlError);
    }
  }

  try {
    const result = await runPipeline(validated);
    if ("error" in result) {
      const status = errorCodeToStatus(result.error.code);
      log.debug("POST /api/sheets/import returning", { status, errorCode: result.error.code });
      return NextResponse.json(result, { status });
    }
    log.debug("POST /api/sheets/import returning", { status: 200, cardCount: result.cards.length, hasWarning: !!("warning" in result) });
    return NextResponse.json(result);
  } catch (err) {
    log.error("POST /api/sheets/import: pipeline failed", err);
    return errorResponse("FETCH_ERROR", "The import service encountered an unexpected error. Please try again.", 500);
  }
}
