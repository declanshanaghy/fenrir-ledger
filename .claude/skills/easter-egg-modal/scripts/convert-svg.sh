#!/usr/bin/env bash
# convert-svg.sh — Convert a Fenrir Ledger SVG artifact to a raster image.
#
# Usage:
#   convert-svg.sh <input.svg> <output-file> <FORMAT>
#
# Arguments:
#   input.svg     Path to the source SVG file (must exist)
#   output-file   Destination path including filename and extension
#   FORMAT        One of: PNG  WEBP  JPEG  GIF  (case-insensitive)
#
# Exit codes:
#   0  Success
#   1  Wrong number of arguments
#   2  Unsupported format
#   3  Input file not found
#   4  ImageMagick convert not found
#   5  Conversion failed

set -euo pipefail

# ── Argument validation ────────────────────────────────────────────────────────

if [[ $# -ne 3 ]]; then
  echo "ERROR: Expected 3 arguments, got $#." >&2
  echo "Usage: $0 <input.svg> <output-file> <FORMAT>" >&2
  echo "       FORMAT: PNG | WEBP | JPEG | GIF" >&2
  exit 1
fi

INPUT="$1"
OUTPUT="$2"
FORMAT="${3^^}"  # uppercase

# ── Supported format check ─────────────────────────────────────────────────────

case "$FORMAT" in
  PNG|WEBP|JPEG|GIF)
    ;;
  *)
    echo "ERROR: Unsupported format '${3}'." >&2
    echo "       Supported formats: PNG  WEBP  JPEG  GIF" >&2
    exit 2
    ;;
esac

# ── Input file check ───────────────────────────────────────────────────────────

if [[ ! -f "$INPUT" ]]; then
  echo "ERROR: Input file not found: $INPUT" >&2
  exit 3
fi

# ── ImageMagick check ─────────────────────────────────────────────────────────

if ! command -v convert &>/dev/null; then
  echo "ERROR: ImageMagick 'convert' command not found." >&2
  echo "       Install it with:" >&2
  echo "         macOS:   brew install imagemagick" >&2
  echo "         Ubuntu:  sudo apt-get install imagemagick" >&2
  exit 4
fi

# ── Ensure output directory exists ────────────────────────────────────────────

OUTPUT_DIR="$(dirname "$OUTPUT")"
mkdir -p "$OUTPUT_DIR"

# Void background color — matches Fenrir Ledger design token
BG="#07070d"

# ── Format-specific conversion ────────────────────────────────────────────────

echo "Converting: $INPUT → $OUTPUT ($FORMAT)"

case "$FORMAT" in

  PNG)
    convert \
      -background "$BG" \
      -flatten \
      "$INPUT" \
      "$OUTPUT"
    ;;

  WEBP)
    convert \
      -background "$BG" \
      -flatten \
      -quality 90 \
      "$INPUT" \
      "webp:$OUTPUT"
    ;;

  JPEG)
    # JPEG has no alpha channel; flatten with void background first
    convert \
      -background "$BG" \
      -flatten \
      -quality 90 \
      -colorspace sRGB \
      "$INPUT" \
      "jpeg:$OUTPUT"
    ;;

  GIF)
    # GIF palette is 256 colours; dither for smoother gradients
    convert \
      -background "$BG" \
      -flatten \
      -colors 256 \
      -dither Riemersma \
      "$INPUT" \
      "gif:$OUTPUT"
    ;;

esac

# ── Verify output ─────────────────────────────────────────────────────────────

if [[ ! -s "$OUTPUT" ]]; then
  echo "ERROR: Conversion produced an empty or missing file: $OUTPUT" >&2
  exit 5
fi

SIZE=$(du -sh "$OUTPUT" | cut -f1)
echo "OK: $OUTPUT  ($SIZE)"
