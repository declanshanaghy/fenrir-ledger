# 003 — Brandify Agent Rewrite: MDX-Only Chronicle Publisher

## Context

`generate-agent-report.mjs` is 2068 lines serving two output modes: HTML (local viewing) and MDX (chronicle publishing). The HTML mode is dead weight — chronicles are the only consumer. The MDX mode outputs JSX syntax (`className=`, `{JSON.stringify()}`, `style={{}}`) but the chronicles renderer uses `MDXRemote` with `format: "md"` + `rehypeRaw` which only understands plain HTML. Result: every published chronicle renders as broken text.

## Goal

Rewrite `generate-agent-report.mjs` to ONLY produce MDX chronicles with plain HTML (not JSX). Kill HTML mode, kill mayo hecklers, kill shared CSS/JS assets. Support both single-log and multi-log saga input.

## File Structure (current → target)

```
Current (2068 lines):
  Lines 1-30:      imports                          → KEEP
  Lines 31-53:     CLI args, flags                  → SIMPLIFY (remove --publish, --regen-assets, --output)
  Lines 55-460:    CSS/JS assets, index, profiles   → DELETE ENTIRELY
  Lines 462-1099:  log parsing, stats, metadata     → KEEP AS-IS
  Lines 1100-1705: MDX publish mode                 → REWRITE (JSX → HTML)
  Lines 1707-2068: HTML mode                        → DELETE ENTIRELY

Target (~800-900 lines):
  Imports + CLI args                                 ~30 lines
  Log parsing, stats, metadata (unchanged)          ~640 lines
  MDX output (HTML syntax, no hecklers)             ~200 lines
```

## Kill List

| What | Why |
|------|-----|
| HTML output mode (lines 1707-2068) | Dead — chronicles are the only consumer |
| `--publish` flag | MDX is now the only mode, no flag needed |
| `--regen-assets` flag + `writeAssets()` | No more CSS/JS assets to generate |
| `--output` flag | No more HTML output path |
| Chronicle CSS loading (lines 55-65) | Was embedded in HTML output |
| Profile modal JS (lines 66-460) | Was for HTML interactive profiles |
| `writeIndex()` function | Was for HTML index page |
| `showProfile()` function | Was for HTML profile modals |
| `writeAssets()` function | Was for CSS/JS file generation |
| `regenOnly` block | No assets to regenerate |
| Mayo heckler import + engine | Hecklers removed from chronicles |
| `createHecklerEngine()` call | No more hecklers |
| All `hecklerEngine.*` calls | No more hecklers |
| `mdxRenderHeckleEvents()` | No more hecklers |
| `MDX_HECKLER_AVATARS` | No more hecklers |
| `mdxHecklerAvatar()` | No more hecklers |
| Heckler avatar copy to public/ | No more hecklers |
| `victoryHeckle` markup | No more hecklers |
| `mdxEsc()` function | Replace with `esc()` (already exists for HTML mode) |
| `jsxStr()` function | Replace with direct `esc()` inline |
| `mdxSafeStringify()` function | Replace with `esc()` |
| `mdxToolInputPreview()` | Replace with `toolInputPreview()` (already exists) |
| `mdxRenderToolInput()` | Replace with `renderToolInput()` (already exists) |
| `mdxRenderToolOutput()` | Replace with `renderToolOutput()` (already exists) |

## JSX → HTML Conversion Rules

Every piece of the MDX output section needs these changes:

| JSX (current) | HTML (target) |
|---------------|---------------|
| `className="foo"` | `class="foo"` |
| `{${JSON.stringify(text)}}` | `${esc(text)}` |
| `{${mdxSafeStringify(text)}}` | `${esc(text)}` |
| `jsxStr(text)` | `esc(text)` |
| `style={{color: "red"}}` | `style="color: red"` |
| `style={{color:"${var}"}}` | `style="color: ${var}"` |
| `<img ... loading="lazy" />` | `<img ... loading="lazy">` (self-closing optional in HTML) |

## Saga Support

The `combine-saga.mjs` script already handles multi-file combination. The rewritten script just needs to accept `--input` pointing at the combined saga log — no changes needed to the report generator for saga support. Document in SKILL.md that multi-file input goes through `combine-saga.mjs` first.

## Implementation Steps

### Step 1 — Delete HTML mode (lines 1707-2068)
Delete everything from `// Build HTML` to end of file.

### Step 2 — Delete asset generation (lines 55-460)
Delete: chronicle CSS loading, profile JS, `writeAssets()`, `writeIndex()`, `showProfile()`, `regenOnly` block, all the CSS/JS string generation functions.

### Step 3 — Remove mayo heckler import and all heckler code
- Remove `import { createHecklerEngine }`
- Remove `const hecklerEngine = createHecklerEngine(agentName)`
- Remove `mdxRenderHeckleEvents()`, `mdxHecklerAvatar()`, `MDX_HECKLER_AVATARS`
- Remove all `hecklerEngine.maybeHeckle()` calls
- Remove `victoryHeckle` markup
- Remove heckler avatar copy block

### Step 4 — Simplify CLI args
- Remove `--publish`, `--output`, `--regen-assets`, `--output-dir` flags
- `--input` and `--blog-dir` are the only flags
- Default `--blog-dir` to `development/ledger/content/blog` relative to repo root

### Step 5 — Remove `if (publishMode) {` wrapper
The MDX output code is currently inside `if (publishMode) { ... }`. Remove the wrapper — it's now the only path.

### Step 6 — Convert all JSX to HTML in MDX output
Apply the conversion rules table above to every template string in the MDX section. Key areas:
- `mdxRenderToolBlock()` → use `class=`, `esc()` for text
- `mdxRenderEntrypoint()` → already uses `class=` and `esc()` ✓ (this was the HTML helper)
- Turn markup template strings → `class=`, `esc()` for text
- Stats grid → `class=`, plain text
- Changes/commits markup → `class=`, `esc()`
- Verdict markup → `class=`, `esc()`
- Callback/decree markup → `class=`, `esc()`
- Frontmatter → keep as-is

### Step 7 — Reuse existing HTML helper functions
The file already has `esc()`, `toolBadgeClass()`, `toolInputPreview()`, `renderToolInput()`, `renderToolOutput()`, `turnSummary()`, `renderEntrypoint()`, `fmtNum()` — all using `class=` and `esc()`. The MDX section has duplicate `mdx*` versions of these. Delete the `mdx*` versions, use the originals.

### Step 8 — Update MDX compile validation
Keep the post-generation MDX compile check. Update the `@mdx-js/mdx` import path resolution (already dynamic). The compiled MDX should pass since we're now outputting valid HTML, not JSX.

### Step 9 — Update SKILL.md
- Remove `--publish` from usage (it's the default now)
- Remove `--regen-assets`
- Remove HTML output references
- Document saga mode
- Update examples

### Step 10 — Update `sanitize-chronicle.mjs` reference
Keep the sanitization — it handles secret masking in tool output. No changes needed.

## Verification

1. Generate single-log chronicle:
   ```
   node generate-agent-report.mjs --input tmp/agent-logs/issue-1833-step1-luna-74f55242.log
   ```
2. Generate saga chronicle:
   ```
   node combine-saga.mjs --output tmp/agent-logs/saga-1833.log --sort file1.log file2.log file3.log
   node generate-agent-report.mjs --input tmp/agent-logs/saga-1833.log
   ```
3. Verify MDX compiles: script does this automatically
4. Start dev server: `just dev`
5. Browse `http://localhost:3000/chronicles/<slug>` — verify renders correctly with:
   - Proper styling from `chronicle.css`
   - Collapsible turn details
   - Tool badges
   - Stats grid
   - No raw `{...}` text or `className` attributes visible
   - No heckler content

## Test Files

- `/Users/declanshanaghy/Downloads/issue-1833-step1-luna-74f55242.log`
- `/Users/declanshanaghy/Downloads/issue-1833-step2-firemandecko-5a59d50d.log`
- `/Users/declanshanaghy/Downloads/issue-1833-step3-loki-33f5d0b4.log`
- Combined saga: `tmp/agent-logs/saga-issue-1833.log` (already generated)
