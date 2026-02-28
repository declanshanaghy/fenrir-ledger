# Story: Branch-Based CI/CD with Vercel Preview Deployments

- **As a**: developer on Fenrir Ledger
- **I want**: every feature branch to get an isolated Vercel preview deployment, and only main to go to production
- **So that**: I can review and QA changes in a real deployed environment before they reach users
- **Priority**: P2-High
- **Status**: Backlog
- **Created**: 2026-02-28
- **Last revised**: 2026-02-28
- **Sprint target**: Next infra sprint

---

## Context

The current `vercel.yml` workflow fires on every push to `main` and deploys straight to
production. This means:

- There is no way to preview a feature branch in a real deployment before merging
- Every commit — including doc-only changes — burns Vercel's free-tier quota (100 deployments/day)
- We have repeatedly hit the quota limit, causing legitimate production deploys to fail

This story replaces the single workflow with a two-path CI/CD strategy: preview on
branches, production on main, with path filters to skip deploys for doc-only commits.

---

## Problem Statement

A single-path CI/CD that deploys everything to production on every push is unsafe for
collaborative development. Feature branches have no deployment environment for review.
Doc-only commits waste deployment quota on artifacts that have no functional difference.

---

## Target User

The development team (currently one person, designed to scale to collaborators).

---

## Desired Outcome

- Feature branches get a Vercel Preview URL automatically on push
- The preview URL is posted as a bot comment on the open PR — no hunting for it
- Only merges to `main` deploy to production
- Doc-only commits (designs, architecture, product, quality) never trigger a deploy on any branch
- Setup is automated via CLI wherever possible; manual steps are minimal and documented

---

## Scope

### In Scope

- Split `vercel.yml` into two workflow files: `vercel-preview.yml` and `vercel-production.yml`
- Path filter on both workflows (see paths below)
- PR bot comment with preview URL using `actions/github-script` (no third-party action)
- Add Vercel Preview environment variables via `vercel env add` CLI (same values as Production initially)
- Document any remaining manual steps as an explicit checklist

### Out of Scope

- Branch protection rules on `main` (stays unprotected for now)
- Separate secret values for Preview vs Production (will be rotated before GA)
- Automatic PR creation on branch push
- Slack / notification integrations

---

## Path Filter

### Triggers a deploy (app + assets changed)

```
development/src/**
static/**
sessions/**
.github/workflows/**
vercel.json
```

### Skipped (doc-only, no deploy)

```
designs/**
architecture/**
product/**
quality/**
memory/**
*.md   (root-level markdown)
```

---

## Acceptance Criteria

- [ ] Push to a feature branch with app/asset changes → Vercel preview deployment created
- [ ] Preview URL posted as a comment on the open PR by the Actions bot
- [ ] Push to `main` → production deployment (existing behaviour preserved)
- [ ] Doc-only commit on any branch → no deployment triggered, workflow skipped
- [ ] `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` present in Vercel **Preview** environment
- [ ] `vercel pull --environment=preview` used in the branch workflow (not `--environment=production`)
- [ ] No new GitHub Actions secrets required — `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` already in place
- [ ] All Vercel and GitHub config steps are scripted or CLI-driven; manual checklist (if any) is ≤ 5 items

---

## Technical Notes for FiremanDecko

### Workflow split

Replace `.github/workflows/vercel.yml` with two files:

**`vercel-preview.yml`**
```yaml
on:
  push:
    branches-ignore: [main]
    paths:
      - 'development/src/**'
      - 'static/**'
      - 'sessions/**'
      - '.github/workflows/**'
      - 'vercel.json'
permissions:
  contents: read
  pull-requests: write   # required to post PR comment
```

**`vercel-production.yml`**
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'development/src/**'
      - 'static/**'
      - 'sessions/**'
      - '.github/workflows/**'
      - 'vercel.json'
```

### Preview deploy command

```bash
PREVIEW_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})
```

Capture stdout; pass to the PR comment step.

### PR comment (no third-party action)

Use `actions/github-script`:
```yaml
- uses: actions/github-script@v7
  with:
    script: |
      const body = `## Vercel Preview\n\n🔍 **Preview URL:** ${process.env.PREVIEW_URL}`;
      const { data: comments } = await github.rest.issues.listComments({
        owner: context.repo.owner, repo: context.repo.repo,
        issue_number: context.issue.number,
      });
      const existing = comments.find(c => c.body.startsWith('## Vercel Preview'));
      if (existing) {
        await github.rest.issues.updateComment({ owner: context.repo.owner,
          repo: context.repo.repo, comment_id: existing.id, body });
      } else {
        await github.rest.issues.createComment({ owner: context.repo.owner,
          repo: context.repo.repo, issue_number: context.issue.number, body });
      }
```

### Vercel Preview env var setup (CLI — run once during implementation)

```bash
# Copy production values into Preview environment
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID preview
vercel env add GOOGLE_CLIENT_SECRET preview
```

These use the same values as Production initially. Rotated before GA.

### Remaining manual steps (checklist for implementer)

These cannot be fully scripted and must be done in the Vercel / GitHub dashboards:
1. Verify Preview environment shows both variables in Vercel → Settings → Environment Variables
2. Confirm `GITHUB_TOKEN` has `pull-requests: write` in the workflow permissions block

---

## Open Questions

None — all resolved during backlog grooming (2026-02-28).

| Question | Resolution |
|----------|------------|
| PR comment? | ✅ Yes — `actions/github-script`, no third-party |
| Path filter? | ✅ Yes — paths listed above |
| Branch protection on main? | ✅ No — stays unprotected |
| Same secrets for Preview and Production? | ✅ Yes initially; rotated before GA |
| Manual setup minimised? | ✅ Yes — `vercel env add` + `gh` CLI preferred; ≤ 5 manual steps |
