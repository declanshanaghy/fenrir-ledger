# Test Rules — Shared Between FiremanDecko and Loki

## jest-dom Assertion Library (UNBREAKABLE)

`@testing-library/jest-dom` is globally available via `src/__tests__/setup.ts` — no per-file import.

| Raw (forbidden) | jest-dom (required) |
|---|---|
| `expect(el).not.toBeNull()` | `expect(el).toBeInTheDocument()` |
| `expect(el !== null).toBe(true)` | `expect(el).toBeInTheDocument()` |
| `expect(el.textContent).toBe('X')` | `expect(el).toHaveTextContent('X')` |
| `expect(el.textContent).toContain('X')` | `expect(el).toHaveTextContent('X')` |
| `expect(el.className).toContain('X')` | `expect(el).toHaveClass('X')` |
| `expect(screen.queryBy*()).toBeNull()` | `expect(screen.queryBy*()).not.toBeInTheDocument()` |
| `expect(el).toBeTruthy()` (DOM) | `expect(el).toBeInTheDocument()` |
| `expect(el).toBeDefined()` (DOM) | `expect(el).toBeInTheDocument()` |
| `expect(el.getAttribute('x')).toBe('y')` | `expect(el).toHaveAttribute('x', 'y')` |

## Banned Test Categories (UNBREAKABLE)

Do NOT write tests for:
- GitHub Actions workflows, Helm charts, Terraform, Dockerfiles, K8s manifests
- Markdown/docs, config files, static page copy/content
- CSS class name assertions, animation timing
- Any test that `readFileSync` a file and asserts on string content
- Any test that counts files or checks file existence
- `expect(true).toBe(true)` or any tautological assertion

**Rule:** If the test breaks on a config/copy edit but not on a logic bug, don't write it.

## No Tests for odins-throne or odins-spear (UNBREAKABLE)

`development/odins-throne/` and `development/odins-spear/` have no test infrastructure. Validate via tsc + build only.

## No Hardcoded Dates (UNBREAKABLE)

Use `new Date(Date.now() + 10 * 86_400_000).toISOString()`, never `"2026-04-02T..."`.

## Mock Every Dependency (UNBREAKABLE)

Read implementation before writing tests. If it calls `ensureFreshToken()`, `getSession()`, `fetch()`, mock ALL of them.

## Never Check Out Main to Compare Failures (UNBREAKABLE)

Fix all test failures regardless of origin. Don't `git checkout main` to compare.

## No Infrastructure Tests (UNBREAKABLE)

Helm charts, Terraform, K8s manifests, Dockerfiles, and CI/CD workflows are not testable via Vitest.

## Over-Tested Sources — Do Not Add Tests (UNBREAKABLE)

Files with 37x+ average LCOV hit count are saturated. Redirect coverage to uncovered code.

| File | Avg Hit |
|------|--------:|
| `MarketingNavLinks.tsx` | 274x |
| `api/sync/route.ts` | 214x |
| `firestore-types.ts` | 145x |
| `sync-engine.ts` | 67x |
| `button.tsx` | 62x |
| `HeilungModal.tsx` | 61x |
| `useCloudSync.ts` | 61x |
| `trial-utils.ts` | 60x |
| `realm-utils.ts` | 56x |
| `LedgerTopBar.tsx` | 52x |
| `settings/page.tsx` | 46x |
| `chronicles.ts` | 37x |
