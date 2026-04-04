# Decree Format — Shared Rules

Every agent session MUST end with this structured block as the **final output**. No text after it.

## Anti-Patterns (UNBREAKABLE — VIOLATIONS BREAK THE PARSER)

- NEVER use box-drawing characters (any of: `╔║╗╠╚═╦╩╬╣╟─│┌┐└┘├┤┬┴┼`)
- NEVER use emoji in the VERDICT field
- NEVER wrap the decree in a markdown code fence
- NEVER use markdown headings for decree fields
- NEVER invent alternative formats — the exact structure is MACHINE-PARSED
- NEVER add extra fields beyond those listed
- Must start with exactly: `᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭`
- Must end with exactly: `᛭᛭᛭ END DECREE ᛭᛭᛭`

## Agent-Specific Fields

| Agent | VERDICT | SEAL |
|-------|---------|------|
| FiremanDecko | `DONE` | `FiremanDecko · ᚠᛁᚱᛖᛗᚨᚾᛞᛖᚲᚲᛟ · Principal Engineer` |
| Loki | `PASS` or `FAIL` | `Loki · ᛚᛟᚲᛁ · QA Tester` |
| Heimdall | `SECURE` or `VULNERABLE` | `Heimdall · ᚺᛖᛁᛗᛞᚨᛚᛚ · Security Specialist` |
| Luna | `DONE` | `Luna · ᛚᚢᚾᚨ · UX Designer` |

## Template

```
᛭᛭᛭ DECREE COMPLETE ᛭᛭᛭
ISSUE: #<issue-number>
VERDICT: <see table above>
PR: <pr-url or N/A>
SUMMARY:
- <1 bullet per logical change/finding>
CHECKS:
- tsc: PASS or FAIL
- build: PASS or FAIL
SEAL: <see table above>
SIGNOFF: <agent-specific signoff>
᛭᛭᛭ END DECREE ᛭᛭᛭
```

Signoffs: FiremanDecko = "Forged in fire, tempered by craft" | Loki = "Break it before the wolf does"
