# Fenrir Ledger

<table>
  <tr>
    <td colspan="4">
      <a href="LICENSE.md"><img src="https://img.shields.io/badge/LICENSE-ELv2-c9920a?style=for-the-badge&labelColor=07070d" alt="License: ELv2"></a>
    </td>
  </tr>
  <tr>
    <td colspan="4">
      <a href="https://github.com/declanshanaghy/fenrir-ledger/actions/workflows/vercel-production.yml"><img src="https://img.shields.io/github/actions/workflow/status/declanshanaghy/fenrir-ledger/vercel-production.yml?branch=main&style=for-the-badge&label=Production&logo=vercel&logoColor=white&labelColor=07070d" alt="Production Deploy"></a>
    </td>
  </tr>
  <tr>
    <td><a href="https://github.com/declanshanaghy/fenrir-ledger/commits/main"><img src="https://img.shields.io/github/last-commit/declanshanaghy/fenrir-ledger?style=for-the-badge&color=c9920a&logo=git&logoColor=white&labelColor=07070d" alt="Last Commit"></a></td>
    <td><a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-15-000000?style=for-the-badge&logo=next.js&logoColor=white&labelColor=07070d" alt="Next.js 15"></a></td>
    <td><a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white&labelColor=07070d" alt="TypeScript strict"></a></td>
    <td><a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind-CSS-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white&labelColor=07070d" alt="Tailwind CSS"></a></td>
  </tr>
</table>

**Break free from fee traps. Harvest every reward. Let no chain hold.**

> *In Norse mythology, Fenrir is the great wolf who shatters the chains the gods forged to bind him.*
> *Fenrir Ledger breaks the invisible chains of forgotten annual fees, expired promotions,*
> *and wasted sign-up bonuses that silently devour your wallet.*

---

<table><tr>
<td align="center" width="33%">

**<a href="https://fenrir-ledger.vercel.app" target="_blank" rel="noopener">Enter the Ledger</a>**

*Name your chains before they name you.*

</td>
<td align="center" width="33%">

**<a href="https://fenrir-ledger.vercel.app/static" target="_blank" rel="noopener">Marketing Site</a>**

*Read the runes. Know what hunts next.*

</td>
<td align="center" width="33%">

**<a href="https://fenrir-ledger.vercel.app/sessions" target="_blank" rel="noopener">Session Chronicles</a>**

*Every session forged in fire, recorded in runes.*

</td>
</tr></table>

---

Track every credit card in your portfolio. Every annual fee deadline, promo expiration, and sign-up bonus threshold — Fenrir watches and howls before the trap snaps shut. Add your cards, set your thresholds, and the wolf does the rest.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind · Vercel (serverless) · Stripe (subscriptions) · localStorage (data)

---

## Quick Start

```bash
git clone https://github.com/declanshanaghy/fenrir-ledger.git
cd fenrir-ledger
./development/scripts/setup-local.sh
.claude/scripts/services.sh start
# Open http://localhost:9653
```

---

## The Pack

| Role | Wolf | Scroll | Domain |
|------|------|--------|--------|
| Product Owner | Freya | [Agent](.claude/agents/freya.md) | [product/](product/README.md) |
| UX Designer | Luna | [Agent](.claude/agents/luna.md) | [ux/](ux/README.md) |
| Principal Engineer | FiremanDecko | [Agent](.claude/agents/fireman-decko.md) | [development/](development/README.md) · [architecture/](architecture/) |
| Security Specialist | Heimdall | [Agent](.claude/agents/heimdall.md) | [security/](security/README.md) |
| QA Tester | Loki | [Agent](.claude/agents/loki.md) | [quality/](quality/README.md) — 577 tests across 26 suites |

## The Pipeline

```mermaid
graph LR
    classDef role fill:#03A9F4,stroke:#0288D1,color:#FFF
    classDef done fill:#4CAF50,stroke:#388E3C,color:#FFF

    po(Freya) --> ux(Luna)
    ux -->|design brief| eng(FiremanDecko)
    eng -->|implementation| sec(Heimdall)
    sec -->|security review| qa(Loki)
    qa -->|ship / no-ship| ship([Accepted])

    class po,ux,eng,sec,qa role
    class ship done
```

---

## ᚱ Key Documentation ᚢᚾᛖᛋ

| ᚱᚢᚾᛖ | Domain | Sacred Scrolls |
|------|--------|----------------|
| ᚠ | **Product** *(Freya speaks)* | [Product Brief](product-brief.md) — *The vision I have laid before the pack* · [Design Brief](product/product-design-brief.md) — *My counsel to the forge-master* · [Backlog](product/backlog/README.md) — *The hunts I have ordered by urgency* |
| ᛚ | **UX** *(Luna shapes)* | [Theme System](ux/theme-system.md) — *The runes of color and shadow I have woven* · [Wireframes](ux/wireframes.md) — *Bones of every screen, drawn before steel is poured* · [Interactions](ux/interactions.md) — *How the wolf moves when touched* |
| ᛞ | **Architecture** *(FiremanDecko engineers)* | [System Design](architecture/system-design.md) — *The load-bearing bones of this hall* · [ADRs](architecture/adrs/) — *Every decision forged in fire, never undone lightly* · [Pipeline](architecture/pipeline.md) — *The channel through which all work flows* · [Remote Builders (ADR-007)](architecture/adrs/ADR-007-remote-builder-platforms.md) — *Why Depot carries our iron* |
| ᚺ | **Security** *(Heimdall watches)* | [Security Index](security/README.md) — *I see all nine worlds; nothing passes unwatched* · [Google API Review](security/reports/2026-03-02-google-api-integration.md) — *The reckoning of keys and scopes I have audited* |
| ᛏ | **Quality** *(Loki tests)* | [Test Suites](quality/test-suites/) — *Every trap I have laid to catch the careless* · [Quality Report](quality/quality-report.md) — *My verdict on what stands and what crumbles* · [Test Plan](quality/test-plan.md) — *The chaos I have scheduled, in order* |
| ᛟ | **Operations** *(the pack's shared craft)* | [Git Convention](.claude/skills/git-commit/SKILL.md) — *How all wolves mark their kills* · [Mermaid Guide](ux/ux-assets/mermaid-style-guide.md) — *Runes for rendering diagrams* · [Depot Setup](.claude/scripts/depot-setup.sh) — *Lighting the forge from cold iron* · [Fire Next Up](.claude/skills/fire-next-up/SKILL.md) — *The rite of passing the flame* |

---

## Lineage

Forged from [ZeroForge](https://github.com/declanshanaghy/zeroforge) with improvements from [Vulcan Brownout](https://github.com/declanshanaghy/vulcan-brownout). Claude Code multi-agent infrastructure adapted from [claude-code-hooks-multi-agent-observability](https://github.com/disler/claude-code-hooks-multi-agent-observability) by [@disler](https://github.com/disler).

*"Though it looks like silk ribbon, no chain is stronger."* — Prose Edda, Gylfaginning

---

## License

Copyright (C) 2026 Declan Shanaghy. Licensed under the [Elastic License 2.0 (ELv2)](LICENSE.md) — free for personal use; no competing hosted/managed service.
