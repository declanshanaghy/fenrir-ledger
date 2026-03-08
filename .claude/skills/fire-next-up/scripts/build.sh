#!/usr/bin/env bash
# build.sh — Pre-compile pack-status.ts to pack-status.mjs via esbuild
# Run after editing pack-status.ts. The .mjs is checked in for zero-startup execution.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

npx esbuild "$SCRIPT_DIR/pack-status.ts" \
  --bundle \
  --platform=node \
  --target=node20 \
  --format=esm \
  --outfile="$SCRIPT_DIR/pack-status.mjs"

echo "Built pack-status.mjs ($(wc -c < "$SCRIPT_DIR/pack-status.mjs" | tr -d ' ') bytes)"
