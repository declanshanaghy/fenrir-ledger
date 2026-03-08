# Chronicle HTML Skeleton

**IMPORTANT:** Do NOT generate HTML manually. Use the generator script instead:

```bash
SCRIPT_DIR="$(git rev-parse --show-toplevel)/.claude/skills/brandify-session/scripts"
node "$SCRIPT_DIR/generate-chronicle.mjs" \
  --input tmp/sessions/{{NAME}}.json \
  --output sessions/{{NAME}}.html
```

The script generates a complete HTML file that links to `sessions/chronicle.css` for shared styles.

## Component Rules

- Only include `code_snippet`, `bug_fix`, file chips when the Act has such content — omit empty fields
- User messages: `badge-fireman` (Odin) unless content clearly comes from a different persona
- File chips: `.chip-new` for Write, `.chip-mod` for Edit, `.chip-mem` for memory/design docs
- Session title: title-cased, evocative, not mechanical
- Code syntax highlighting: `.ca` (add/green), `.cr` (remove/red), `.cc` (comment/subtle)
- Voice: ancient, unhurried, knowing — rune inscriptions, not UI copy
- `work_summary` field supports inline HTML: use `<span class="hl">` for highlights, `<span class="mono">` for code refs
