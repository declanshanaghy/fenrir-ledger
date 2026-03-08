#!/usr/bin/env -S npx tsx
/**
 * generate-chronicle.ts — Generate a session chronicle HTML from JSON input
 *
 * Usage: echo '{"title":"...","acts":[...]}' | npx tsx generate-chronicle.ts > sessions/NAME.html
 *
 * Or: npx tsx generate-chronicle.ts --input acts.json --output sessions/NAME.html
 *
 * Input JSON schema:
 * {
 *   "title": "Session Title",
 *   "date": "2026-03-07",
 *   "runes": "ᛏ ᚢ ᚢ ᛚ",
 *   "primary_rune": "ᛏ",
 *   "acts": [
 *     {
 *       "title": "Act Title",
 *       "rune": "ᛏ",
 *       "category": "Refactoring",
 *       "user_msg": "the user's message",
 *       "work_summary": "<p>HTML paragraph(s) for the work summary</p>",
 *       "code_snippet": "optional code block content (HTML-escaped)",
 *       "bug_fix": "optional bug description",
 *       "files_new": ["new-file.ts"],
 *       "files_mod": ["existing-file.ts"],
 *       "files_mem": ["memory-file.md"]
 *     }
 *   ]
 * }
 */

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV'];

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=Cinzel:wght@400;600;700&family=Source+Serif+4:ital,opsz,wght@0,8..60,300;0,8..60,400;0,8..60,600;1,8..60,300;1,8..60,400&family=JetBrains+Mono:wght@400;500;600&display=swap";

interface Act {
  title: string;
  rune: string;
  category: string;
  user_msg?: string;
  work_summary: string;
  code_snippet?: string;
  bug_fix?: string;
  files_new?: string[];
  files_mod?: string[];
  files_mem?: string[];
}

interface SessionData {
  title: string;
  date: string;
  runes: string;
  primary_rune: string;
  acts: Act[];
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function generateAct(act: Act, index: number): string {
  const num = index + 1;
  const roman = ROMAN[index] ?? String(num);

  let userBlock = '';
  if (act.user_msg) {
    userBlock = `
        <div class="user-msg">
          <div class="msg-role">
            <span class="role-badge badge-fireman">Odin</span>
          </div>
          <p class="msg-text">${esc(act.user_msg)}</p>
        </div>`;
  }

  let codeBlock = '';
  if (act.code_snippet) {
    codeBlock = `
          <div class="code-block"><pre>${act.code_snippet}</pre></div>`;
  }

  let bugBlock = '';
  if (act.bug_fix) {
    bugBlock = `
          <div class="bug-box">
            <p class="bug-label">Bug Fixed</p>
            <p class="bug-text">${esc(act.bug_fix)}</p>
          </div>`;
  }

  const chips: string[] = [];
  for (const f of act.files_new ?? []) chips.push(`<span class="chip chip-new">${esc(f)}</span>`);
  for (const f of act.files_mod ?? []) chips.push(`<span class="chip chip-mod">${esc(f)}</span>`);
  for (const f of act.files_mem ?? []) chips.push(`<span class="chip chip-mem">${esc(f)}</span>`);

  let chipsBlock = '';
  if (chips.length > 0) {
    chipsBlock = `
          <div class="file-chips">
            ${chips.join('\n            ')}
          </div>`;
  }

  return `
    <section class="entry" id="act-${num}">
      <div class="entry-rune" title="${esc(act.title)}">${act.rune}</div>
      <div class="entry-body">
        <p class="act-label">Act ${roman} &middot; ${esc(act.category)}</p>
        <h2 class="entry-title">${esc(act.title)}</h2>
${userBlock}
        <div class="work-card">
          <div class="work-body">${act.work_summary}</div>${codeBlock}${bugBlock}${chipsBlock}
        </div>
      </div>
    </section>`;
}

function generateTocEntry(act: Act, index: number): string {
  const num = index + 1;
  const roman = ROMAN[index] ?? String(num);
  return `      <li><a href="#act-${num}"><span class="toc-rune">${act.rune}</span> <span class="toc-num">${roman}</span> ${esc(act.title)}</a></li>`;
}

function countFiles(data: SessionData): number {
  const all = new Set<string>();
  for (const act of data.acts) {
    for (const f of act.files_new ?? []) all.add(f);
    for (const f of act.files_mod ?? []) all.add(f);
    for (const f of act.files_mem ?? []) all.add(f);
  }
  return all.size;
}

function generate(data: SessionData): string {
  const totalFiles = countFiles(data);
  const toc = data.acts.map(generateTocEntry).join('\n');
  const acts = data.acts.map(generateAct).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.primary_rune} Session Chronicle: ${esc(data.title)} &middot; Fenrir Ledger</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS_URL}" rel="stylesheet">
  <link rel="stylesheet" href="/sessions/chronicle.css">
</head>
<body>
<div class="page">

  <nav class="back-nav" aria-label="Return to archive">
    <a href="/sessions/" class="back-link">&larr; &#5999; Session Archive</a>
  </nav>

  <header class="session-header">
    <span class="header-runes">${data.runes}</span>
    <h1 class="session-title">${esc(data.title)}</h1>
    <p class="session-subtitle">Session Chronicle &middot; Fenrir Ledger</p>
    <div class="session-meta">
      <span>DATE <span class="val">${data.date}</span></span>
      <span>ACTS <span class="val">${data.acts.length}</span></span>
      <span>FILES CHANGED <span class="val">${totalFiles}</span></span>
    </div>
  </header>

  <nav class="toc">
    <div class="toc-title">Chronicle of Acts</div>
    <ul class="toc-list">
${toc}
    </ul>
  </nav>

  <div class="timeline">
${acts}
  </div>

  <footer class="session-footer">
    <div class="footer-cipher">${data.runes}</div>
    <div class="footer-text">${esc(data.title)} &middot; Fenrir Ledger Session Chronicle</div>
    <p class="footer-sub">The wolf remembers everything.</p>
  </footer>

</div>
</body>
</html>
`;
}

// --- CLI ---

import { readFileSync, writeFileSync } from 'fs';

const args = process.argv.slice(2);
let inputPath = '';
let outputPath = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--input' && args[i + 1]) inputPath = args[++i];
  else if (args[i] === '--output' && args[i + 1]) outputPath = args[++i];
}

let jsonStr: string;
if (inputPath) {
  jsonStr = readFileSync(inputPath, 'utf-8');
} else {
  // Read from stdin
  jsonStr = readFileSync(0, 'utf-8');
}

const data: SessionData = JSON.parse(jsonStr);
const html = generate(data);

if (outputPath) {
  writeFileSync(outputPath, html);
  console.log(`Generated ${outputPath} (${data.acts.length} acts, ${countFiles(data)} files)`);
} else {
  process.stdout.write(html);
}
