#!/usr/bin/env -S npx tsx

// .claude/skills/brandify-session/scripts/generate-chronicle.ts
import { readFileSync, writeFileSync } from "fs";
var ROMAN = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV"
];
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function generateAct(act, index) {
  const num = index + 1;
  const roman = ROMAN[index] ?? String(num);
  let userBlock = "";
  if (act.user_msg) {
    userBlock = `
        <div className="user-msg">
          <div className="msg-role">
            <span className="role-badge badge-fireman">Odin</span>
          </div>
          <p className="msg-text">${esc(act.user_msg)}</p>
        </div>`;
  }
  let codeBlock = "";
  if (act.code_snippet) {
    codeBlock = `
          <div className="code-block"><pre>${act.code_snippet}</pre></div>`;
  }
  let bugBlock = "";
  if (act.bug_fix) {
    bugBlock = `
          <div className="bug-box">
            <p className="bug-label">Bug Fixed</p>
            <p className="bug-text">${esc(act.bug_fix)}</p>
          </div>`;
  }
  const chips = [];
  for (const f of act.files_new ?? []) chips.push(`<span className="chip chip-new">${esc(f)}</span>`);
  for (const f of act.files_mod ?? []) chips.push(`<span className="chip chip-mod">${esc(f)}</span>`);
  for (const f of act.files_mem ?? []) chips.push(`<span className="chip chip-mem">${esc(f)}</span>`);
  let chipsBlock = "";
  if (chips.length > 0) {
    chipsBlock = `
          <div className="file-chips">
            ${chips.join("\n            ")}
          </div>`;
  }
  return `
    <section className="entry" id="act-${num}">
      <div className="entry-rune" title="${esc(act.title)}">${act.rune}</div>
      <div className="entry-body">
        <p className="act-label">Act ${roman} \xB7 ${esc(act.category)}</p>
        <h2 className="entry-title">${esc(act.title)}</h2>
${userBlock}
        <div className="work-card">
          <div className="work-body">${act.work_summary}</div>${codeBlock}${bugBlock}${chipsBlock}
        </div>
      </div>
    </section>`;
}
function generateTocEntry(act, index) {
  const num = index + 1;
  const roman = ROMAN[index] ?? String(num);
  return `      <li><a href="#act-${num}"><span className="toc-rune">${act.rune}</span> <span className="toc-num">${roman}</span> ${esc(act.title)}</a></li>`;
}
function countFiles(data2) {
  const all = /* @__PURE__ */ new Set();
  for (const act of data2.acts) {
    for (const f of act.files_new ?? []) all.add(f);
    for (const f of act.files_mod ?? []) all.add(f);
    for (const f of act.files_mem ?? []) all.add(f);
  }
  return all.size;
}
function generate(data2) {
  const totalFiles = countFiles(data2);
  const toc = data2.acts.map(generateTocEntry).join("\n");
  const acts = data2.acts.map(generateAct).join("\n");
  return `---
title: "${data2.title.replace(/"/g, '\\"')}"
date: "${data2.date}"
rune: "${data2.primary_rune}"
excerpt: "${data2.excerpt.replace(/"/g, '\\"')}"
slug: "${data2.slug}"
---

<div className="chronicle-page">

<header className="session-header">
  <span className="header-runes" aria-hidden="true">${data2.runes}</span>
  <h1 className="session-title">${esc(data2.title)}</h1>
  <p className="session-subtitle">Session Chronicle \xB7 Fenrir Ledger</p>
  <div className="session-meta">
      <span>Date <span className="val">${data2.date}</span></span>
      <span>Session <span className="val">${data2.slug}</span></span>
      <span>Acts <span className="val">${data2.acts.length}</span></span>
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
  <div className="footer-cipher">${data2.runes}</div>
  <div className="footer-text">${esc(data2.title)} \xB7 Fenrir Ledger Session Chronicle</div>
  <p className="footer-sub">The wolf remembers everything.</p>
</footer>

</div>
`;
}
var args = process.argv.slice(2);
var inputPath = "";
var outputPath = "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--input" && args[i + 1]) inputPath = args[++i];
  else if (args[i] === "--output" && args[i + 1]) outputPath = args[++i];
}
var jsonStr;
if (inputPath) {
  jsonStr = readFileSync(inputPath, "utf-8");
} else {
  jsonStr = readFileSync(0, "utf-8");
}
var data = JSON.parse(jsonStr);
var mdx = generate(data);
if (outputPath) {
  writeFileSync(outputPath, mdx);
  console.log(`Generated ${outputPath} (${data.acts.length} acts, ${countFiles(data)} files)`);
} else {
  process.stdout.write(mdx);
}
