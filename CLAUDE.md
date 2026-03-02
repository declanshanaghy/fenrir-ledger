# Fenrir Ledger — Claude Code Rules

## Branching (UNBREAKABLE RULE)

**Never commit or push directly to `main`.** All work happens on a branch, regardless of how small the change.

1. `git checkout main && git pull origin main`
2. `git checkout -b <type>/<description>`
3. Implement, commit, push the branch
4. Open a PR → merge via PR only

See `.claude/skills/git-commit/SKILL.md` for branch naming conventions and the full workflow.

## Repository Self-Containment (UNBREAKABLE RULE)

**This repo MUST be fully self-contained. No file in this repo — and no artifact it
installs outside the repo (e.g. shell snippets in `~/.zshrc`) — may reference paths
inside `.claude/worktrees/`.** Worktrees are ephemeral and deleted after use.

Specifically:
- **Scripts that write paths into external config files** (e.g. `terminal/install.sh`
  writing to `~/.zshrc`) MUST resolve to the **main worktree / repo root**, never
  a sub-worktree path. Use `git worktree list --porcelain | head -1` to find the
  primary checkout.
- **Symlinks** created by installers MUST target files in the main repo, not a worktree.
- **Source statements, imports, and include directives** written to files outside this
  repo MUST use stable paths that survive worktree cleanup.
- Before writing any path to an external file, **verify it does not contain
  `.claude/worktrees/`** in the path string.
- **Source/include directives written to external files** (e.g. `~/.zshrc`) MUST
  guard with an existence check so the shell does not error if the repo is missing
  or moved. Use `[[ -f "<path>" ]] && source "<path>"` — never a bare `source`.

## Shell Customization Locations (UNBREAKABLE RULE)

**Never append shell customizations directly to `~/.zshrc`.** Use the appropriate
profile file based on scope:

| Scope | File | When to use |
|---|---|---|
| Common / shared | `~/.config/zsh/zshrc` | Aliases, functions, and env vars that apply everywhere |
| Personal projects | `~/.config/zsh/zshrc.dshanaghy` | Personal project paths, tokens, tool configs |
| Work (Cribl) | `~/.config/zsh/zshrc.cribl` | Work-specific env, paths, tool configs |

`~/.zshrc` sources these files — treat it as read-only infrastructure.

## Security

### Secret Masking (UNBREAKABLE RULE)

**All secrets, tokens, keys, and credentials MUST be masked in every output, log, comment,
and tool result — without exception. This rule can NEVER be broken.**

Masking format: show the first 4 and last 4 characters with `x`s filling the middle.
The number of `x`s must reflect the actual secret length (total length − 8).

**Formula:**
```
masked = secret[0..3] + "x".repeat(secret.length - 8) + secret[-4..]
```

**Examples:**

| Secret length | Example masked output |
|---|---|
| 32 chars | `ABCDxxxxxxxxxxxxxxxxxxxxxxxxWXYZ` |
| 40 chars | `ABCDxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxWXYZ` |
| 20 chars | `ABCDxxxxxxxxxxxxxxxxWXYZ` → 20-8=12 x's: `ABCDxxxxxxxxxxxxWXYZ` |

**Applies to:**
- API keys (Vercel, Google, AWS, GitHub tokens, etc.)
- OAuth secrets (`GOOGLE_CLIENT_SECRET`, `VERCEL_TOKEN`, etc.)
- Bypass secrets (`VERCEL_AUTOMATION_BYPASS_SECRET`, etc.)
- Any value read from `.env`, `.env.local`, GitHub secrets, or secret stores
- Secrets appearing in URLs, query params, headers, or log output
- Tool call outputs that echo back secret values

**When a tool result contains an unmasked secret**, restate it masked before continuing.
Never re-echo the raw value in any follow-up message.

### No Secrets in Conversation (UNBREAKABLE RULE)

**Never ask the user to paste, type, or provide secrets, tokens, keys, or credentials
directly into the Claude Code conversation.** Always read secrets from the files the
app already uses for configuration:

- `.env`, `.env.local`, `.env.production` — Next.js / Node environment files
- `.secret` files — any project-specific secret stores
- Vercel env vars — read via `vercel env pull` or `vercel env ls`
- GitHub Actions secrets — managed via `gh secret set` / `gh secret list`

When a secret needs to be set or updated:
1. **Read it from the source file** (e.g. `.env.local`) — never ask the user to paste it.
2. **Pipe from file to CLI** when configuring external services
   (e.g. `vercel env add KEY production < <(grep '^KEY=' .env.local | cut -d= -f2-)`).
3. If the value doesn't exist in any file yet, **ask the user to add it to the
   appropriate `.env` file first**, then read it from there.

### No Secrets in Public-Facing Output (UNBREAKABLE RULE)

**Secrets, tokens, and bypass values MUST NEVER appear in any public-facing output —
without exception. This includes PR comments, commit messages, issue bodies, GitHub
Actions step summaries, Slack messages, or any other output visible to anyone with
repo read access.**

This repo is public. Every PR comment is world-readable.

**Specifically forbidden:**
- Appending `?x-vercel-protection-bypass=<secret>` (or any secret) to URLs in PR comments
- Logging secret values in GitHub Actions `run:` steps without masking
- Embedding secrets in artifact file names, paths, or content
- Writing raw secret values to `$GITHUB_STEP_SUMMARY` or `$GITHUB_OUTPUT`

**The bypass secret used for Playwright tests must travel only via:**
- `extraHTTPHeaders` inside the Playwright runner (never logged)
- GitHub Actions secrets (`${{ secrets.* }}`) — GitHub automatically masks these in logs

**If you need to give a human access to a protected preview deployment**, link to the
plain URL only. Do not append the bypass secret. The human can obtain access through
Vercel's dashboard or by rotating their own credentials.

### API Route Auth (UNBREAKABLE RULE)

**Every API route handler under `development/frontend/src/app/api/` MUST call
`requireAuth(request)` at the top of the handler and return early if `!auth.ok`.**

The only exception is `/api/auth/token` -- the OAuth token exchange proxy
cannot require a Bearer token because the client is obtaining its token there.

Pattern:
```typescript
import { requireAuth } from "@/lib/auth/require-auth";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  // auth.user is the verified Google user
  // ... handler logic
}
```

See ADR-008 for the rationale and `src/lib/auth/require-auth.ts` for the
implementation.
