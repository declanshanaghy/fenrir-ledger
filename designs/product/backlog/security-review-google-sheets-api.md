# Backlog: Security Review — Google Sheets API Integration

## Problem Statement

Fenrir Ledger integrates with Google APIs across multiple surfaces (OAuth, Sheets import, Drive Picker). These integrations handle authentication tokens, API keys, and user data. A focused security review is needed to verify that:

1. Credentials are properly scoped and not over-permissioned
2. Tokens are stored, transmitted, and refreshed securely
3. API keys are not leaked to the client bundle
4. User data from Google (spreadsheet content, profile info) is handled safely
5. The OAuth flow follows current best practices (PKCE, state parameter, etc.)

## Scope

### In scope
- Google OAuth 2.0 flow (PKCE, token exchange proxy, session management)
- Google Sheets URL import pipeline (fetch → CSV → LLM extraction)
- Google Drive Picker integration (API key delivery, token scoping)
- Server-side API route auth guards (`requireAuth`)
- Environment variable handling (client vs server, `NEXT_PUBLIC_` prefix rules)
- Secret masking in logs and output
- CORS and CSP headers
- Token refresh and expiration handling

### Out of scope (for now)
- General frontend XSS/CSRF (covered by Next.js defaults)
- Infrastructure/hosting security (Vercel platform responsibility)
- LLM prompt injection (separate concern)

## Key Files to Review

| Area | Files |
|------|-------|
| OAuth flow | `src/contexts/AuthContext.tsx`, `src/lib/auth/refresh-session.ts` |
| Token exchange proxy | `src/app/api/auth/token/route.ts` |
| Auth guard | `src/lib/auth/require-auth.ts` |
| Sheets import API | `src/app/api/sheets/import/route.ts` |
| Import pipeline | `src/lib/sheets/import-pipeline.ts`, `src/lib/sheets/csv-import-pipeline.ts` |
| Picker config API | `src/app/api/config/picker/route.ts` |
| Picker hook | `src/hooks/usePickerConfig.ts` |
| Drive token hook | `src/hooks/useDriveToken.ts` |
| Environment config | `.env.local`, `.env.example` |
| CLAUDE.md rules | `CLAUDE.md` (secret masking, API route auth rules) |

## Review Checklist

- [ ] OAuth scopes are minimal (only what's needed for Sheets read + Drive file pick)
- [ ] `GOOGLE_CLIENT_SECRET` never appears in client bundle (`NEXT_PUBLIC_` prefix absent)
- [ ] `GOOGLE_PICKER_API_KEY` served only to authenticated users via API route
- [ ] `FENRIR_ANTHROPIC_API_KEY` never appears in client bundle
- [ ] Token exchange proxy validates redirect URI
- [ ] ID tokens are verified server-side (signature, audience, expiry)
- [ ] Refresh tokens are not stored in localStorage (only in memory/httpOnly cookie)
- [ ] API routes return appropriate CORS headers
- [ ] Error responses don't leak internal details (stack traces, file paths)
- [ ] Rate limiting exists on import endpoints (or documented as needed)
- [ ] Google Sheets data is not persisted server-side after extraction
- [ ] Sensitive data warnings (SSN, card numbers) are shown to users

## Priority

High — security review should happen before any additional Google API integrations ship.

## Suggested Approach

Use a dedicated security review agent that can:
1. Trace data flow from user input to API response
2. Check for OWASP Top 10 patterns
3. Verify secret handling against CLAUDE.md rules
4. Produce a structured report with findings, severity, and remediation
