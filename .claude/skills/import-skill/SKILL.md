# Import Skill — .claude/ Artifact Importer

Import skills, agents, and commands from an external repo's `.claude/` directory into this project.

## Trigger

Use when the user says "import skill", "import from repo", "import .claude artifacts", or provides a repo path to import from.

## Arguments

- `$ARGUMENTS` — the source repo path (absolute or `~/`-relative). Optional flags:
  - `--skills-only` — import only skills
  - `--agents-only` — import only agents
  - `--commands-only` — import only commands
  - `--namespace <name>` — put commands under `.claude/commands/<name>/` (default: no namespace)
  - `--dry-run` — show what would be imported without copying
  - `--all` — import everything without prompting

## Workflow

### 1. Validate Source

```
SOURCE_DIR = resolve $ARGUMENTS to absolute path
Verify $SOURCE_DIR/.claude/ exists
If not: error "No .claude/ directory found at $SOURCE_DIR"
```

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

### 6. Report

Print summary:

```
## Import Complete

Imported N artifacts from <source-repo>:
- Skills: <list>
- Agents: <list>
- Commands: <list>

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
