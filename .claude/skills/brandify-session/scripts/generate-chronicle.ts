#!/usr/bin/env -S npx tsx
/**
 * generate-chronicle.ts — Generate a session chronicle MDX from JSON input
 *
 * Usage: echo '{"title":"...","acts":[...]}' | npx tsx generate-chronicle.ts > content/blog/NAME.mdx
 *
 * Or: npx tsx generate-chronicle.ts --input acts.json --output content/blog/NAME.mdx
 *
 * Input JSON schema:
 * {
 *   "title": "Session Title",
 *   "date": "2026-03-07",
 *   "runes": "ᛏ ᚢ ᚢ ᛚ",
 *   "primary_rune": "ᛏ",
 *   "slug": "session-name",
 *   "excerpt": "One-sentence summary for the blog index.",
 *   "acts": [
 *     {
 *       "title": "Act Title",
 *       "rune": "ᛏ",
 *       "category": "Refactoring",
 *       "user_msg": "the user's message",
 *       "work_summary": "<p>JSX paragraph(s) for the work summary (use className, not class)</p>",
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
  slug: string;
  excerpt: string;
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
        <div className="user-msg">
          <div className="msg-role">
            <span className="role-badge badge-fireman">Odin</span>
          </div>
          <p className="msg-text">${esc(act.user_msg)}</p>
        </div>`;
  }

  let codeBlock = '';
  if (act.code_snippet) {
    codeBlock = `
          <div className="code-block"><pre>${act.code_snippet}</pre></div>`;
  }

  let bugBlock = '';
  if (act.bug_fix) {
    bugBlock = `
          <div className="bug-box">
            <p className="bug-label">Bug Fixed</p>
            <p className="bug-text">${esc(act.bug_fix)}</p>
          </div>`;
  }

  const chips: string[] = [];
  for (const f of act.files_new ?? []) chips.push(`<span className="chip chip-new">${esc(f)}</span>`);
  for (const f of act.files_mod ?? []) chips.push(`<span className="chip chip-mod">${esc(f)}</span>`);
  for (const f of act.files_mem ?? []) chips.push(`<span className="chip chip-mem">${esc(f)}</span>`);

  let chipsBlock = '';
  if (chips.length > 0) {
    chipsBlock = `
          <div className="file-chips">
            ${chips.join('\n            ')}
          </div>`;
  }

  return `
    <section className="entry" id="act-${num}">
      <div className="entry-rune" title="${esc(act.title)}">${act.rune}</div>
      <div className="entry-body">
        <p className="act-label">Act ${roman} · ${esc(act.category)}</p>
        <h2 className="entry-title">${esc(act.title)}</h2>
${userBlock}
        <div className="work-card">
          <div className="work-body">${act.work_summary}</div>${codeBlock}${bugBlock}${chipsBlock}
        </div>
      </div>
    </section>`;
}

function generateTocEntry(act: Act, index: number): string {
  const num = index + 1;
  const roman = ROMAN[index] ?? String(num);
  return `      <li><a href="#act-${num}"><span className="toc-rune">${act.rune}</span> <span className="toc-num">${roman}</span> ${esc(act.title)}</a></li>`;
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

  return `---
title: "${data.title.replace(/"/g, '\\"')}"
date: "${data.date}"
rune: "${data.primary_rune}"
excerpt: "${data.excerpt.replace(/"/g, '\\"')}"
slug: "${data.slug}"
---

<div className="chronicle-page">

<header className="session-header">
  <span className="header-runes" aria-hidden="true">${data.runes}</span>
  <h1 className="session-title">${esc(data.title)}</h1>
  <p className="session-subtitle">Session Chronicle · Fenrir Ledger</p>
  <div className="session-meta">
      <span>Date <span className="val">${data.date}</span></span>
      <span>Session <span className="val">${data.slug}</span></span>
      <span>Acts <span className="val">${data.acts.length}</span></span>
      <span>Files changed <span className="val">${totalFiles}</span></span>
  </div>
</header>

<nav className="toc">
  <div className="toc-title">Chronicle of Acts</div>
  <ul className="toc-list">
${toc}
  </ul>
</nav>

<div className="timeline">
${acts}
</div>

<footer className="session-footer">
  <div className="footer-cipher">${data.runes}</div>
  <div className="footer-text">${esc(data.title)} · Fenrir Ledger Session Chronicle</div>
  <p className="footer-sub">The wolf remembers everything.</p>
</footer>

</div>
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
const mdx = generate(data);

if (outputPath) {
  writeFileSync(outputPath, mdx);
  console.log(`Generated ${outputPath} (${data.acts.length} acts, ${countFiles(data)} files)`);
} else {
  process.stdout.write(mdx);
}
