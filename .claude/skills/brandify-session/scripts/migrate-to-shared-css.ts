#!/usr/bin/env -S npx tsx
/**
 * migrate-to-shared-css.ts — Replace inline <style> blocks with <link> to chronicle.css
 *
 * Usage: npx tsx migrate-to-shared-css.ts sessions/*.html
 *
 * Skips index.html. For each file:
 * 1. Removes everything between <style> and </style> (inclusive)
 * 2. Inserts <link rel="stylesheet" href="/sessions/chronicle.css"> after the fonts link
 * 3. Adds .footer-sub style if missing from shared CSS (it's in the shared CSS now)
 */

import { readFileSync, writeFileSync } from 'fs';

const files = process.argv.slice(2).filter(f => !f.endsWith('index.html'));

for (const file of files) {
  let html = readFileSync(file, 'utf-8');

  // Check if already migrated
  if (html.includes('chronicle.css')) {
    console.log(`SKIP ${file} (already migrated)`);
    continue;
  }

  // Remove <style>...</style> block
  const styleStart = html.indexOf('<style>');
  const styleEnd = html.indexOf('</style>');
  if (styleStart === -1 || styleEnd === -1) {
    console.log(`SKIP ${file} (no <style> block found)`);
    continue;
  }

  const before = html.substring(0, styleStart);
  const after = html.substring(styleEnd + '</style>'.length);

  // Insert the CSS link
  const cssLink = '  <link rel="stylesheet" href="/sessions/chronicle.css">';
  html = before.trimEnd() + '\n' + cssLink + '\n' + after.trimStart();

  // Clean up any double blank lines
  html = html.replace(/\n{3,}/g, '\n\n');

  writeFileSync(file, html);
  const savings = readFileSync(file, 'utf-8').length;
  console.log(`DONE ${file}`);
}

console.log(`\nMigrated ${files.length} files`);
