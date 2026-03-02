# Import Skill — .claude/ Artifact Importer

Import skills, agents, and commands from an external repo's `.claude/` directory into this project.

## Trigger

Use when the user says "import skill", "import from repo", "import .claude artifacts", or provides a repo path or GitHub URL to import from.

## Arguments

- `$ARGUMENTS` — the source. Accepts any of:
  - **GitHub URL** — `git@github.com:user/repo.git`, `https://github.com/user/repo`, or `github.com/user/repo`
  - **Local path** — absolute path or `~/`-relative to an already-cloned repo
- Optional flags:
  - `--skills-only` — import only skills
  - `--agents-only` — import only agents
  - `--commands-only` — import only commands
  - `--namespace <name>` — put commands under `.claude/commands/<name>/` (default: no namespace)
  - `--dry-run` — show what would be imported without copying
  - `--all` — import everything without prompting

## Workflow

### 1. Resolve Source

Determine whether `$ARGUMENTS` is a GitHub URL or a local path.

**GitHub URL detection** — matches any of:
- `git@github.com:<owner>/<repo>.git`
- `https://github.com/<owner>/<repo>` (with or without `.git` suffix)
- `github.com/<owner>/<repo>`

If a GitHub URL is detected:

```
OWNER = extract owner from URL
REPO  = extract repo name from URL (strip .git suffix)
CLONE_DIR = ~/src/github.com/$OWNER/$REPO

If $CLONE_DIR already exists and is a git repo:
  cd $CLONE_DIR && git pull origin HEAD
  Print "Using existing clone at $CLONE_DIR (updated)"
Else:
  mkdir -p ~/src/github.com/$OWNER
  git clone <url> $CLONE_DIR
  Print "Cloned to $CLONE_DIR"

SOURCE_DIR = $CLONE_DIR
```

If a local path:

```
SOURCE_DIR = resolve $ARGUMENTS to absolute path
```

**Validate**: verify `$SOURCE_DIR/.claude/` exists. If not: error "No .claude/ directory found at $SOURCE_DIR".

**Derive attribution URL**: for GitHub URLs, use `https://github.com/$OWNER/$REPO`. For local paths, check `git -C $SOURCE_DIR remote get-url origin` to extract the GitHub URL. If neither works, use the raw path.

### 2. Discover Artifacts

Scan the source `.claude/` for:

| Category | Location | Pattern |
|----------|----------|---------|
| Skills | `.claude/skills/*/SKILL.md` | Each directory with a SKILL.md is one skill |
| Agents | `.claude/agents/*.md` | Each .md file is one agent |
| Commands | `.claude/commands/**/*.md` | Each .md file is one command (preserve subdirectory structure) |

Skip `settings.json` — never import settings (they're environment-specific).

### 3. Present Inventory

Print a table:

```
## Source: <repo-name> (<path>)

| # | Category | Name | Path | Conflict? |
|---|----------|------|------|-----------|
| 1 | skill | playwright-bowser | skills/playwright-bowser/ | No |
| 2 | agent | bowser-qa-agent | agents/bowser-qa-agent.md | No |
...
```

**Conflict detection**: check if the destination path already exists in this repo's `.claude/`.
Mark conflicts with "YES — exists" in the table.

### 4. Select Artifacts

- If `--all` flag: import everything.
- If category flag (`--skills-only`, etc.): filter to that category.
- Otherwise: ask the user which items to import (by number or "all").

### 5. Copy Artifacts

For each selected artifact:

```
SOURCE = <source-repo>/.claude/<artifact-path>
DEST   = <this-repo>/.claude/<artifact-path>

# For commands with --namespace:
#   SOURCE: .claude/commands/build.md
#   DEST:   .claude/commands/<namespace>/build.md
#   (preserve subdirectories within the namespace)

If DEST exists and artifact was not explicitly confirmed:
  Ask user: "Overwrite <DEST>? [y/N]"

Copy the entire directory for skills (includes docs/, examples/, etc.)
Copy the single .md file for agents and commands
```

Use `cp -r` for skill directories (they may contain subdirectories like `docs/`, `examples/`).

### 6. Add Attribution

After copying each artifact, inject an `attribution` line into the YAML frontmatter of every imported `.md` file.

**Format:**
```yaml
attribution: Imported from <ATTRIBUTION_URL> — credit to @<OWNER>
```

**Injection rules:**
- If the file has YAML frontmatter (starts with `---`), add the `attribution` line before the closing `---`.
- If the file has no frontmatter, skip attribution for that file (don't create frontmatter that might break the artifact).
- If an `attribution` line already exists, replace it with the new one.

**Example** — before:
```yaml
---
name: playwright-bowser
description: Headless browser automation
allowed-tools: Bash
---
```

After:
```yaml
---
name: playwright-bowser
description: Headless browser automation
allowed-tools: Bash
attribution: Imported from https://github.com/disler/bowser — credit to @disler
---
```

### 7. Report

Print summary:

```
## Import Complete

Imported N artifacts from <source-repo> (<ATTRIBUTION_URL>):
- Skills: <list>
- Agents: <list>
- Commands: <list>

Attribution: all imported files tagged with source URL and author.
Skipped (conflicts): <list or "none">

### Next Steps
- Restart Claude Code to pick up new skills/agents/commands
- Check imported artifacts for project-specific paths that need adapting
```

## Conflict Resolution

| Scenario | Action |
|----------|--------|
| Destination does not exist | Copy directly |
| Destination exists, `--all` flag | Ask before overwriting |
| Destination exists, user confirms | Overwrite |
| Destination exists, user declines | Skip, note in report |

## Notes

- Never import `settings.json` — settings are environment-specific
- Preserve the full directory structure of skills (they often have `docs/`, `examples/` subdirs)
- Commands with subdirectories (e.g., `commands/bowser/`) are preserved as-is, then optionally wrapped in the namespace directory
- After import, suggest reviewing any imported `prime.md` or context-priming commands for project-specific file references
- Attribution is mandatory — every imported artifact gets tagged with its source repo and author
