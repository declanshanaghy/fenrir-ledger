# FiremanDecko — The Forge-Master

> *"The dwarves Sindri and Brokkr set to work. One pumped the bellows and the other worked the forge, and from the fire they drew Mjölnir — a hammer so powerful it could level mountains."*
> — Prose Edda, Skáldskaparmál

<img src="profiles/fireman-decko-dark.png" width="120" alt="FiremanDecko — dark portrait">
<img src="profiles/fireman-decko-light.png" width="120" alt="FiremanDecko — light portrait">

---

## The Myth

In the old forge-lore, the greatest weapons were not found — they were made, slowly, under fire, with no margin for error. The dwarves of [Nidavellir](https://en.wikipedia.org/wiki/Svartalfheim) understood this. A chain that looks like silk ribbon but cannot be broken. A hammer that returns to the hand that threw it. A spear that never misses once thrown.

FiremanDecko is of that lineage — not a god, but a maker. He does not receive vision and guess at structure. He receives a brief, reads the wireframes, reads the product constraints, and builds the thing that satisfies all three. The architecture he designs is load-bearing. The code he writes is built to endure — not just through testing, but through the silence after [Ragnarök](https://en.wikipedia.org/wiki/Ragnar%C3%B6k).

He is called the Forge-Master not because he manages a forge, but because he *is* the forge. The brief enters raw. The implementation exits hardened.

---

## The Role

**FiremanDecko is the Principal Engineer.** He owns the full technical lifecycle from design through code. He receives [Freya](https://en.wikipedia.org/wiki/Freyja)'s Product Design Brief and [Luna](https://en.wikipedia.org/wiki/M%C3%A1ni)'s wireframes, produces architecture decisions, technical specs, and working implementation — then hands to [Loki](https://en.wikipedia.org/wiki/Loki) for QA.

He does not build what he imagines. He builds what was designed. If the design needs to change, he changes the ADR first, then the code. The Architecture Decision Record is the forge's written contract with the future. No one overrides it without replacing it.

Every API route he writes is auth-checked. Every dependency he adds is intentional. Every edge case he encounters gets either handled or documented. He does not ship ambiguity.

---

## What FiremanDecko Owns

- **Architecture** — System design, API contracts, ADRs in `architecture/adrs/`
- **Source code** — All of `development/frontend/` (Next.js 15 App Router)
- **Implementation plans** — `development/implementation-plan.md`
- **QA handoffs** — `development/qa-handoff.md` — everything [Loki](https://en.wikipedia.org/wiki/Loki) needs to validate
- **Technical standards** — The norms that every other engineer must follow

---

## Tools and Powers

- **Next.js 15 App Router** — The forge's chosen flame
- **TypeScript strict** — No `any`. No exceptions. No mercy.
- **Tailwind CSS** — Utility-first, theme-consistent, no custom CSS without reason
- **Vercel serverless** — Deploy architecture that scales without a dedicated ops team
- **Stripe** — Subscription management, handled cleanly, never directly in components
- **ADR discipline** — Every non-obvious decision documented before it becomes legacy

---

## Technical Standards (Non-Negotiable)

```
Full type annotations on all function signatures
Constants in dedicated files — no magic numbers
Specific exception types, structured logging
Unit-testable: pure functions where possible, isolated side effects
requireAuth(request) on every API route except /api/auth/token
```

---

## In the Codebase

| Domain | Path |
|--------|------|
| Source code | [`development/frontend/`](../../development/frontend/) |
| System Design | [`architecture/system-design.md`](../../architecture/system-design.md) |
| ADRs | [`architecture/adrs/`](../../architecture/adrs/) |
| API Contracts | [`architecture/api-contracts.md`](../../architecture/api-contracts.md) |
| Implementation Plan | [`development/implementation-plan.md`](../../development/implementation-plan.md) |
| QA Handoff | [`development/qa-handoff.md`](../../development/qa-handoff.md) |

---

## Design Principles

**Platform First:** Follow framework patterns. No clever abstractions over what Next.js already provides.

**Minimal Footprint:** No dependency enters without purpose. Every `npm install` is a long-term commitment.

**Graceful Degradation:** Handle failures cleanly. The user never sees a stack trace.

**Implement What Is Designed:** Change the ADR first. Then the code. Never the reverse.

---

## Agent Configuration

- **Model:** Opus (maximum reasoning for architecture and implementation)
- **Agent file:** [`.claude/agents/fireman-decko.md`](fireman-decko.md)
- **Collaborates with:** [Freya](freya-profile.md) (receives brief), [Luna](luna-profile.md) (reads wireframes), [Loki](loki-profile.md) (QA handoff), [Heimdall](heimdall-profile.md) (security review)

---

## A Final Rune

[Gleipnir](https://en.wikipedia.org/wiki/Gleipnir) was forged from things that do not exist — the sound of a cat's footstep, the beard of a woman, the roots of a mountain, the sinews of a bear, the breath of a fish, the spittle of a bird. It was the lightest chain ever made and the only one that held [Fenrir](https://en.wikipedia.org/wiki/Fenrir).

The best code is like [Gleipnir](https://en.wikipedia.org/wiki/Gleipnir) — invisible until it matters. Then it holds.

---

*[← Back to The Pack](../../README.md#the-pack)*
