#!/usr/bin/env bash
# build.sh — Pre-compile generate-chronicle.ts to .mjs via esbuild
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

npx esbuild "$SCRIPT_DIR/generate-chronicle.ts" \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile="$SCRIPT_DIR/generate-chronicle.mjs"

echo "Built generate-chronicle.mjs ($(wc -c < "$SCRIPT_DIR/generate-chronicle.mjs" | tr -d ' ') bytes)"
