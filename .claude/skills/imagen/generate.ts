#!/usr/bin/env npx tsx
/**
 * Fenrir Ledger — Imagen Generator
 *
 * Generates images using Google Gemini API with the Fenrir Ledger Norse wolf
 * aesthetic. Supports free-form prompts and built-in presets.
 *
 * Usage:
 *     npx tsx generate.ts "A Norse wolf head logo"
 *     npx tsx generate.ts --preset fenrir-logo
 *     npx tsx generate.ts --preset fenrir-medallion --size 16:9 --output badge.png
 *     npx tsx generate.ts --preset fenrir-medallion --count 4
 *
 * Requires GOOGLE_API_KEY or GEMINI_API_KEY environment variable.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname, basename, extname, join } from "path";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/" +
  "gemini-3.1-flash-image-preview:generateContent";

const REQUEST_TIMEOUT_MS = 60_000;

const PRESETS: Record<string, string> = {
  "fenrir-logo":
    "A fierce Norse wolf head in a circular medallion frame with runic " +
    "inscriptions around the border, metallic silver and ice-blue tones, " +
    "dark moody lighting",
  "fenrir-icon":
    "A compact wolf head icon suitable for favicon use, clean lines, " +
    "Nordic style, metallic finish",
  "norse-badge":
    "An ornate Norse shield badge with intertwined wolf and serpent " +
    "knotwork, aged metal texture",
  "fenrir-medallion":
    "A heavy iron medallion with Fenrir the wolf breaking chains, " +
    "Elder Futhark runes inscribed around the edge, moonlit atmosphere",
};

const VALID_ASPECT_RATIOS = new Set(["1:1", "16:9", "9:16", "4:3", "3:4"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

function buildRequestBody(prompt: string, aspectRatio: string) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio },
    },
  };
}

async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: string
): Promise<Buffer[]> {
  const url = `${GEMINI_ENDPOINT}?key=${apiKey}`;
  const body = JSON.stringify(buildRequestBody(prompt, aspectRatio));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error(`[imagen] Request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`);
      process.exit(1);
    }
    console.error(`[imagen] Network error: ${err}`);
    process.exit(1);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`[imagen] API error: HTTP ${response.status}\n${errorBody}`);
    process.exit(1);
  }

  const responseBody = await response.json();

  const images: Buffer[] = [];
  const candidates = responseBody.candidates ?? [];
  for (const candidate of candidates) {
    const parts = candidate.content?.parts ?? [];
    for (const part of parts) {
      const inlineData = part.inlineData ?? part.inline_data;
      if (
        inlineData &&
        ((inlineData.mimeType ?? "").startsWith("image/") ||
          (inlineData.mime_type ?? "").startsWith("image/"))
      ) {
        const raw = inlineData.data;
        if (raw) {
          images.push(Buffer.from(raw, "base64"));
        }
      }
    }
  }

  if (images.length === 0) {
    console.error(
      "[imagen] No image data found in API response. Response structure:\n" +
        JSON.stringify(responseBody, null, 2).slice(0, 2000)
    );
    process.exit(1);
  }

  return images;
}

function outputPath(base: string, index: number, count: number): string {
  if (count === 1) return base;
  const ext = extname(base) || ".png";
  const stem = basename(base, ext);
  const dir = dirname(base);
  return join(dir, `${stem}-${index + 1}${ext}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]) {
  const args: {
    prompt?: string;
    preset?: string;
    size: string;
    output?: string;
    count: number;
  } = { size: "1:1", count: 1 };

  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg === "--preset" && i + 1 < argv.length) {
      args.preset = argv[++i];
    } else if (arg === "--size" && i + 1 < argv.length) {
      args.size = argv[++i];
    } else if (arg === "--output" && i + 1 < argv.length) {
      args.output = argv[++i];
    } else if (arg === "--count" && i + 1 < argv.length) {
      args.count = parseInt(argv[++i], 10);
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npx tsx generate.ts \"<prompt>\" [--preset <name>] [--size <ratio>] [--output <path>] [--count <n>]\n\n" +
          "Presets: " + Object.keys(PRESETS).join(", ") + "\n" +
          "Sizes: " + [...VALID_ASPECT_RATIOS].join(", ")
      );
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      args.prompt = arg;
    }
    i++;
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.prompt && !args.preset) {
    console.error(
      '[imagen] Error: provide either a prompt or --preset.\n' +
        'Usage: npx tsx generate.ts "<prompt>" or --preset <name>'
    );
    process.exit(1);
  }

  if (args.preset && !PRESETS[args.preset]) {
    console.error(
      `[imagen] Error: unknown preset '${args.preset}'. ` +
        `Valid options: ${Object.keys(PRESETS).join(", ")}`
    );
    process.exit(1);
  }

  if (!VALID_ASPECT_RATIOS.has(args.size)) {
    console.error(
      `[imagen] Error: invalid aspect ratio '${args.size}'. ` +
        `Valid options: ${[...VALID_ASPECT_RATIOS].sort().join(", ")}`
    );
    process.exit(1);
  }

  if (args.count < 1 || args.count > 4) {
    console.error("[imagen] Error: --count must be between 1 and 4.");
    process.exit(1);
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error(
      "[imagen] Error: no API key found.\n\n" +
        "Set one of the following environment variables:\n" +
        "  export GOOGLE_API_KEY=your-key-here\n" +
        "  export GEMINI_API_KEY=your-key-here\n\n" +
        "Get a key at: https://aistudio.google.com/apikey"
    );
    process.exit(1);
  }

  const prompt = args.preset ? PRESETS[args.preset] : args.prompt!;

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const baseOutput = args.output ?? `generated-${timestamp}.png`;

  const savedPaths: string[] = [];

  for (let i = 0; i < args.count; i++) {
    if (args.count > 1) {
      console.error(`[imagen] Generating image ${i + 1} of ${args.count}...`);
    }

    const images = await generateImage(apiKey, prompt, args.size);
    const imageData = images[0];

    const dest = outputPath(baseOutput, i, args.count);
    mkdirSync(dirname(resolve(dest)), { recursive: true });
    writeFileSync(dest, imageData);

    const absPath = resolve(dest);
    savedPaths.push(absPath);
    console.log(absPath);
  }

  console.error(`\n[imagen] Done. ${savedPaths.length} image(s) saved.`);
}

main();
