#!/usr/bin/env python3
"""
Fenrir Ledger — Imagen Generator

Generates images using Google Gemini API with the Fenrir Ledger Norse wolf
aesthetic. Supports free-form prompts and built-in presets.

Usage:
    python3 generate.py "A Norse wolf head logo"
    python3 generate.py --preset fenrir-logo
    python3 generate.py --preset norse-badge --size 16:9 --output badge.png
    python3 generate.py --preset fenrir-medallion --count 4

Requires GOOGLE_API_KEY or GEMINI_API_KEY environment variable.
"""

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

GEMINI_ENDPOINT = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-2.5-flash-preview-05-20:generateContent"
)

REQUEST_TIMEOUT_SECONDS = 60

THEME_PREFIX = (
    "Dark Nordic war-room aesthetic, void-black (#07070d) background, "
    "ice-blue and antique gold (#c9920a) accents, Elder Futhark rune details, "
    "Fenrir wolf motif. The image MUST have a fully transparent PNG background "
    "with no white or colored background. Isolated subject on alpha-transparent "
    "canvas."
)

PRESETS: dict[str, str] = {
    "fenrir-logo": (
        "A fierce Norse wolf head in a circular medallion frame with runic "
        "inscriptions around the border, metallic silver and ice-blue tones, "
        "dark moody lighting"
    ),
    "fenrir-icon": (
        "A compact wolf head icon suitable for favicon use, clean lines, "
        "Nordic style, metallic finish"
    ),
    "norse-badge": (
        "An ornate Norse shield badge with intertwined wolf and serpent "
        "knotwork, aged metal texture"
    ),
    "fenrir-medallion": (
        "A heavy iron medallion with Fenrir the wolf breaking chains, "
        "Elder Futhark runes inscribed around the edge, moonlit atmosphere"
    ),
}

VALID_ASPECT_RATIOS = {"1:1", "16:9", "9:16", "4:3", "3:4"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_api_key() -> Optional[str]:
    """Return the Gemini API key from environment, or None."""
    return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")


def build_request_body(prompt: str, aspect_ratio: str) -> dict:
    """Build the Gemini generateContent request payload."""
    return {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                ],
            },
        ],
        "generationConfig": {
            "responseModalities": ["IMAGE"],
            "imageConfig": {
                "aspectRatio": aspect_ratio,
            },
        },
    }


def resolve_prompt(args: argparse.Namespace) -> str:
    """Resolve the final prompt from either --preset or positional arg.

    The theme prefix is always prepended.
    """
    if args.preset:
        base_prompt = PRESETS[args.preset]
    else:
        base_prompt = args.prompt

    return f"{THEME_PREFIX} {base_prompt}"


def generate_image(api_key: str, prompt: str, aspect_ratio: str) -> list[bytes]:
    """Call Gemini API and return a list of PNG image byte buffers.

    Raises SystemExit on API or network errors.
    """
    url = f"{GEMINI_ENDPOINT}?key={api_key}"
    body = build_request_body(prompt, aspect_ratio)
    data = json.dumps(body).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            response_body = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        error_body = ""
        try:
            error_body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        print(
            f"[imagen] API error: HTTP {exc.code}\n{error_body}",
            file=sys.stderr,
        )
        sys.exit(1)
    except urllib.error.URLError as exc:
        print(f"[imagen] Network error: {exc.reason}", file=sys.stderr)
        sys.exit(1)
    except TimeoutError:
        print(
            f"[imagen] Request timed out after {REQUEST_TIMEOUT_SECONDS}s",
            file=sys.stderr,
        )
        sys.exit(1)

    # Extract image data from response
    images: list[bytes] = []
    candidates = response_body.get("candidates", [])
    for candidate in candidates:
        parts = candidate.get("content", {}).get("parts", [])
        for part in parts:
            inline_data = part.get("inline_data")
            if inline_data and inline_data.get("mime_type", "").startswith("image/"):
                raw_b64 = inline_data.get("data", "")
                if raw_b64:
                    images.append(base64.b64decode(raw_b64))

    if not images:
        print(
            "[imagen] No image data found in API response. "
            "Response structure:\n"
            + json.dumps(response_body, indent=2)[:2000],
            file=sys.stderr,
        )
        sys.exit(1)

    return images


def output_path(base: str, index: int, count: int) -> Path:
    """Compute the output file path for a given image index.

    If count == 1, uses the base path as-is.
    If count > 1, inserts a -N suffix before the extension.
    """
    p = Path(base)
    if count == 1:
        return p
    stem = p.stem
    suffix = p.suffix or ".png"
    return p.with_name(f"{stem}-{index + 1}{suffix}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_parser() -> argparse.ArgumentParser:
    """Build the argument parser."""
    parser = argparse.ArgumentParser(
        prog="imagen",
        description=(
            "Generate images using Google Gemini API with the Fenrir Ledger "
            "Norse wolf aesthetic."
        ),
    )
    parser.add_argument(
        "prompt",
        nargs="?",
        default=None,
        help="Free-form text prompt for image generation.",
    )
    parser.add_argument(
        "--preset",
        choices=list(PRESETS.keys()),
        default=None,
        help="Use a built-in preset prompt.",
    )
    parser.add_argument(
        "--size",
        default="1:1",
        help='Aspect ratio string (default: "1:1"). Valid: 1:1, 16:9, 9:16, 4:3, 3:4.',
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output file path (default: generated-{timestamp}.png).",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=1,
        help="Number of images to generate (default: 1, max: 4).",
    )
    return parser


def validate_args(args: argparse.Namespace) -> None:
    """Validate parsed arguments. Exits on invalid input."""
    if not args.prompt and not args.preset:
        print(
            "[imagen] Error: provide either a prompt or --preset.\n"
            "Usage: python3 generate.py \"<prompt>\" or --preset <name>",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.size not in VALID_ASPECT_RATIOS:
        print(
            f"[imagen] Error: invalid aspect ratio '{args.size}'. "
            f"Valid options: {', '.join(sorted(VALID_ASPECT_RATIOS))}",
            file=sys.stderr,
        )
        sys.exit(1)

    if args.count < 1 or args.count > 4:
        print(
            "[imagen] Error: --count must be between 1 and 4.",
            file=sys.stderr,
        )
        sys.exit(1)


def main() -> None:
    """Entry point."""
    parser = build_parser()
    args = parser.parse_args()

    validate_args(args)

    # Resolve API key
    api_key = get_api_key()
    if not api_key:
        print(
            "[imagen] Error: no API key found.\n"
            "\n"
            "Set one of the following environment variables:\n"
            "  export GOOGLE_API_KEY=your-key-here\n"
            "  export GEMINI_API_KEY=your-key-here\n"
            "\n"
            "Get a key at: https://aistudio.google.com/apikey",
            file=sys.stderr,
        )
        sys.exit(1)

    # Resolve prompt
    prompt = resolve_prompt(args)

    # Default output path
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    base_output = args.output or f"generated-{timestamp}.png"

    # Generate images
    saved_paths: list[str] = []
    for i in range(args.count):
        if args.count > 1:
            print(
                f"[imagen] Generating image {i + 1} of {args.count}...",
                file=sys.stderr,
            )

        images = generate_image(api_key, prompt, args.size)
        image_data = images[0]  # Take first image from response

        dest = output_path(base_output, i, args.count)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(image_data)

        abs_path = str(dest.resolve())
        saved_paths.append(abs_path)
        print(abs_path)

    print(
        f"\n[imagen] Done. {len(saved_paths)} image(s) saved.",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
