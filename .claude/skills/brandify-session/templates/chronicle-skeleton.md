# Chronicle MDX Skeleton

**IMPORTANT:** Do NOT generate MDX manually. Use the generator script instead:

```bash
REPO_ROOT="$(git worktree list --porcelain | head -1 | sed 's/worktree //')"
SCRIPT_DIR="$REPO_ROOT/.claude/skills/brandify-session/scripts"
BLOG_DIR="$REPO_ROOT/development/frontend/content/blog"
node "$SCRIPT_DIR/generate-chronicle.mjs" \
  --input tmp/sessions/{{NAME}}.json \
  --output "$BLOG_DIR/{{NAME}}.mdx"
```

The script generates a complete MDX file with:
- Frontmatter: `title`, `date`, `rune`, `excerpt`, `slug`
- Chronicle body inside `<div class="chronicle-page">` — styled via `chronicle.css`

## Component Rules

- Only include `code_snippet`, `bug_fix`, file chips when the Act has such content — omit empty fields
- User messages: `badge-fireman` (Odin) unless content clearly comes from a different persona
- File chips: `.chip-new` for Write, `.chip-mod` for Edit, `.chip-mem` for memory/design docs
- Session title: title-cased, evocative, not mechanical
- Code syntax highlighting: `.ca` (add/green), `.cr` (remove/red), `.cc` (comment/subtle)
- Voice: ancient, unhurried, knowing — rune inscriptions, not UI copy
- `work_summary` field supports inline HTML: use `<span class="hl">` for highlights, `<span class="mono">` for code refs
