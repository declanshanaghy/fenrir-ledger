#!/usr/bin/env node
/**
 * combine-saga.mjs — Combine multiple agent log files into a single saga log.
 *
 * Sorts files by step number extracted from the filename pattern:
 *   issue-<N>-step<S>-<agent>-<hash>.log
 *
 * Inserts chapter divider comments between sessions so the generator can
 * render chapter breaks in the chronicle.
 *
 * Usage:
 *   node combine-saga.mjs --output <combined.log> --sort <file1.log> <file2.log> ...
 */

import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  return args[i + 1] || null;
}

const outputPath = flag("output");
const sortFlag = args.includes("--sort");

// Collect file paths (everything that isn't a flag or flag value)
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) {
    // Skip flag and its value
    if (args[i] === "--output" || args[i] === "--sort") {
      if (args[i] === "--output") i++; // skip value
      continue;
    }
    continue;
  }
  files.push(args[i]);
}

if (files.length < 2) {
  console.error("Usage: combine-saga.mjs --output <combined.log> --sort <file1> <file2> ...");
  console.error("Need at least 2 log files for saga mode.");
  process.exit(1);
}

if (!outputPath) {
  console.error("Error: --output <path> is required");
  process.exit(1);
}

// Extract step number from filename for sorting
function extractStep(filePath) {
  const name = basename(filePath);
  const match = name.match(/step(\d+)/);
  return match ? parseInt(match[1]) : 999;
}

// Extract agent name from filename
function extractAgent(filePath) {
  const name = basename(filePath);
  const match = name.match(/step\d+-(\w+)/);
  return match ? match[1] : "unknown";
}

// Sort by step number if --sort flag is present
const ordered = sortFlag
  ? [...files].sort((a, b) => extractStep(a) - extractStep(b))
  : files;

// Combine logs with chapter dividers
const parts = [];
for (let i = 0; i < ordered.length; i++) {
  const file = ordered[i];
  const step = extractStep(file);
  const agent = extractAgent(file);
  const name = basename(file, ".log");

  // Chapter divider (plain text line — the generator treats non-JSON lines as entrypoint)
  parts.push(`=== SAGA CHAPTER ${i + 1}: Step ${step} — ${agent} (${name}) ===`);
  parts.push("");

  // Read and append the log content
  const content = readFileSync(file, "utf-8").trim();
  parts.push(content);
  parts.push(""); // blank line between chapters
}

writeFileSync(outputPath, parts.join("\n"));
console.log(`[ok] Combined ${ordered.length} logs into saga: ${outputPath}`);
for (const f of ordered) {
  console.log(`  Step ${extractStep(f)}: ${basename(f)} (${extractAgent(f)})`);
}
