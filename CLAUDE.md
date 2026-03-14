# Fenrir Ledger — Claude Code Rules

## Scripting & Data Processing

Use standard bash tools first: `jq` for JSON, `grep`/`awk`/`sed`/`cut` for text,
`curl` for HTTP, dedicated Claude tools (Glob, Grep, Read) for files.
Only use a full language when the task genuinely requires it.

## Branching (UNBREAKABLE RULE)

**Never commit or push directly to `main`.** All work on a branch, merge via PR only.

1. `git checkout main && git pull origin main`
2. `git checkout -b <type>/<description>`
3. Implement, commit, push, open PR

See `.claude/skills/git-commit/SKILL.md` for conventions.

## Repository Self-Containment (UNBREAKABLE RULE)

No file in this repo may reference paths inside `.claude/worktrees/` — they're ephemeral.

- Scripts writing to external config (e.g. `~/.zshrc`) MUST resolve to the main worktree
  via `git worktree list --porcelain | head -1`
- Symlinks MUST target the main repo, not a worktree
- Before writing any path externally, verify it doesn't contain `.claude/worktrees/`
- External source directives MUST guard: `[[ -f "<path>" ]] && source "<path>"`

## Shell Customization Locations (UNBREAKABLE RULE)

**Never append to `~/.zshrc` directly.** Use:

| Scope | File |
|---|---|
| Common | `~/.config/zsh/zshrc` |
| Personal | `~/.config/zsh/zshrc.dshanaghy` |
| Work | `~/.config/zsh/zshrc.cribl` |

## Security

### Secret Masking (UNBREAKABLE RULE)

All secrets MUST be masked everywhere: first 4 + `x` * (length - 8) + last 4 chars.
Applies to all API keys, tokens, OAuth secrets, env vars, URLs, headers, and tool output.
When a tool result contains an unmasked secret, restate it masked before continuing.

### No Secrets in Conversation (UNBREAKABLE RULE)

Never ask the user to paste secrets. Read from `.env`, `.env.local`, K8s secrets,
or GitHub secrets. If a value doesn't exist yet, ask the user to add it to the
appropriate `.env` file first, then read it from there.

### No Secrets in Public-Facing Output (UNBREAKABLE RULE)

This repo is public. Secrets MUST NEVER appear in PR comments, commit messages, issue
bodies, GH Actions summaries, or any world-readable output. Playwright bypass secrets
travel only via `extraHTTPHeaders` and `${{ secrets.* }}`.

### API Route Auth (UNBREAKABLE RULE)

Every handler under `development/frontend/src/app/api/` MUST call `requireAuth(request)`
and return early if `!auth.ok`. Only exception: `/api/auth/token`.

```typescript
import { requireAuth } from "@/lib/auth/require-auth";
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  // ... handler logic
}
```

## GKE Autopilot Infrastructure (UNBREAKABLE RULE)

Fenrir Ledger runs on **Google Kubernetes Engine (GKE) Autopilot**, not Vercel/Depot.

- **App deployment:** Next.js standalone in GKE Pods via `infrastructure/k8s/app/`
- **Database:** Upstash Redis (KV store) — configured via `KV_REST_API_URL` and `KV_REST_API_TOKEN` env vars (not `@vercel/kv`-specific)
- **Monitoring:** Google Cloud Monitoring — uptime checks, error rates, container health via `infrastructure/monitoring.tf`
- **Dispatch skill:** Uses `dispatch/dispatch-job.sh` to spawn agent sandboxes as GKE Jobs (not Depot remote execution)
- **DNS:** Google-provided Ingress hostname (future: custom domain via Cloud CDN + manual DNS cutover — see issue #684)
- **Secrets:** K8s ConfigMaps and Secrets injected via `infrastructure/k8s/app/deployment.yaml`

See `infrastructure/SMOKE-TEST.md` for GKE verification steps.
