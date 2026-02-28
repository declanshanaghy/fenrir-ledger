# Fenrir Ledger — Claude Code Rules

## Branching (UNBREAKABLE RULE)

**Never commit or push directly to `main`.** All work happens on a branch, regardless of how small the change.

1. `git checkout main && git pull origin main`
2. `git checkout -b <type>/<description>`
3. Implement, commit, push the branch
4. Open a PR → merge via PR only

See `.claude/skills/git-commit/SKILL.md` for branch naming conventions and the full workflow.

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
