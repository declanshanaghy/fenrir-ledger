# Marketing Site Structure — Research Brief
## Ref #180 · Multi-Page Marketing Site

**Status:** Research Complete | **Priority:** P2-High | **Author:** FiremanDecko

---

## 1. Context

The current marketing site is a single static HTML file at `/static/index.html`, served by Next.js from `development/frontend/public/static/`. It contains a hero, a "chains" (pain points) section, a features section, a three-step onboarding flow, and a CTA — all on one page. Legal pages (`/static/privacy.html`, `/static/terms.html`) are standalone HTML files in the same directory.

The `/sessions/` dev blog is a separate set of static HTML files in `development/frontend/public/sessions/`, serving a session chronicle archive of 16 entries covering Fenrir's build history.

The app itself is Next.js 14 on Vercel. The public directory is the correct place for static marketing pages.

---

## 2. Recommended Page List

### Tier 1 — Must Launch (GA prerequisite)

| Page | URL | Rationale |
|------|-----|-----------|
| **Home** | `/` | Top of funnel. Already exists as `/static/index.html`. Needs nav + links to new pages. |
| **Features** | `/features` | Dedicated deep-dive on each named feature (Sköll & Hati, Norns' Weave, The Howl, etc.). Supports SEO for "credit card tracking app" queries. |
| **Pricing** | `/pricing` | Churners are price-sensitive. Explicit Thrall (free) / Karl (paid) tier comparison prevents confusion and reduces support. Critical for conversion. |
| **Privacy Policy** | `/privacy` | Already exists as `/static/privacy.html`. Needs canonical URL at `/privacy`. |
| **Terms of Service** | `/terms` | Already exists as `/static/terms.html`. Needs canonical URL at `/terms`. |

### Tier 2 — High Value (post-GA, within 30 days)

| Page | URL | Rationale |
|------|-----|-----------|
| **Dev Blog / Session Chronicles** | `/blog` | Already exists at `/sessions/`. Re-canonicalize under `/blog` for SEO. "How we built this" content drives organic trust and backlinks from dev community. |
| **Changelog** | `/changelog` | Shows momentum. Churners evaluate tools by recency — a stale changelog is a red flag, an active one is a trust signal. Lightweight markdown-driven page. |
| **FAQ** | `/faq` | Captures SEO long-tail ("does fenrir ledger work with Chase", "is it free", etc.). Reduces support burden. Start with 8-12 real questions from Reddit DPs. |

### Tier 3 — Deferred (post-launch, backlog)

| Page | URL | Rationale |
|------|-----|-----------|
| **About** | `/about` | Personal story from Odin. Humanizes the product. Less urgent until user base is established enough to care. |
| **Roadmap** | `/roadmap` | Transparency play. Only valuable when there's enough shipped history to demonstrate execution. Risk: sets expectations. |
| **Status** | `/status` | Operational status page. Only needed when uptime becomes a user concern. |

---

## 3. URL Structure and Navigation Hierarchy

### Canonical URL Plan

```
fenrirledger.com/               → Home (marketing)
fenrirledger.com/features       → Features deep-dive
fenrirledger.com/pricing        → Tier comparison
fenrirledger.com/blog           → Session Chronicles index  (canonical for /sessions/)
fenrirledger.com/blog/:slug     → Individual session entries (canonical for /sessions/*.html)
fenrirledger.com/changelog      → Release history
fenrirledger.com/faq            → Frequently asked questions
fenrirledger.com/privacy        → Privacy policy           (canonical for /static/privacy.html)
fenrirledger.com/terms          → Terms of service         (canonical for /static/terms.html)
fenrirledger.com/app            → Protected app (redirects to login if unauthenticated)
```

### Primary Navigation (desktop + mobile)

```
[ᚠ Fenrir Ledger]   Features   Pricing   Blog   [Open the Ledger →]
```

- Keep nav minimal — churners are decision-ready users, not tourists
- "Open the Ledger" CTA in nav always links to the app (authenticated entry point)
- No mega-menus; a single-level nav is appropriate for this product stage
- Mobile: hamburger → full-screen overlay with same links

### Footer Navigation

```
Product          Resources        Legal
─────────────    ─────────────    ─────────────
Features         Session Chronicles  Privacy Policy
Pricing          Changelog           Terms of Service
FAQ
```

### Breadcrumb Requirement

Blog entries need breadcrumbs: `Home > Blog > [Session Title]`

---

## 4. Build Approach Recommendation

### Decision: **Stay with Plain HTML in `public/static/` — with a structured upgrade path to Next.js App Router pages**

#### Option A: Plain Static HTML (current approach, extended)
**Pros:**
- Zero build tooling overhead
- Already working in production on Vercel
- Fast to iterate — direct file edits
- No framework lock-in risk

**Cons:**
- No shared layout component — header/footer duplication across every page
- No templating — copy changes require editing every file
- No automated sitemap generation
- CSS/JS bundle management is manual

**Verdict:** Appropriate for pages 1-5, painful at 10+ pages.

---

#### Option B: Astro (SSG)
**Pros:**
- Purpose-built for marketing sites
- Excellent SEO defaults (meta, sitemap, RSS out of the box)
- Zero JS by default — fast Core Web Vitals
- Component-based — shared layout/nav
- Can import existing CSS variables as-is
- Markdown-driven content (blog, changelog, FAQ)

**Cons:**
- Adds a second framework to the repository alongside Next.js
- Separate deploy target or subdirectory routing needed on Vercel
- Team needs to learn Astro conventions
- Two separate build pipelines to maintain

**Verdict:** Best-in-class for marketing sites, but adds operational complexity.

---

#### Option C: Next.js App Router SSG Pages (recommended)
**Pros:**
- Single framework, single deploy, single Vercel project — zero new infrastructure
- `export const dynamic = 'force-static'` or `generateStaticParams` produces static HTML at build time
- Shared layout via `app/(marketing)/layout.tsx` — nav and footer written once
- Next.js `<Link>` and `<Image>` work natively
- `next-mdx-remote` or `contentlayer` makes blog/changelog markdown-driven
- Automatic sitemap generation via `next-sitemap`
- Font optimization already configured (Cinzel, Source Serif 4 already in layout)
- SEO meta via `generateMetadata` — full control per page
- Vercel Analytics and Speed Insights work out of the box

**Cons:**
- Marketing pages and app pages share the same Next.js codebase — risk of coupling
- A global error in layout.tsx could affect both marketing and app
- Slightly more boilerplate than Astro for pure static pages

**Verdict:** **Recommended.** The operational simplicity of one framework/one deploy outweighs Astro's marginal SSG ergonomics advantage for a project this size. The team already knows Next.js; there is no learning curve.

---

### Recommended File Structure

```
development/frontend/src/app/
├── (marketing)/                  ← Route group — no shared app shell
│   ├── layout.tsx                ← Marketing nav + footer (Norse branding)
│   ├── page.tsx                  ← / (home, replaces /static/index.html)
│   ├── features/
│   │   └── page.tsx              ← /features
│   ├── pricing/
│   │   └── page.tsx              ← /pricing
│   ├── faq/
│   │   └── page.tsx              ← /faq
│   ├── changelog/
│   │   └── page.tsx              ← /changelog
│   ├── blog/
│   │   ├── page.tsx              ← /blog (replaces /sessions/index.html)
│   │   └── [slug]/
│   │       └── page.tsx          ← /blog/:slug (replaces /sessions/*.html)
│   ├── privacy/
│   │   └── page.tsx              ← /privacy (replaces /static/privacy.html)
│   └── terms/
│       └── page.tsx              ← /terms (replaces /static/terms.html)
└── (app)/                        ← Existing app routes (unchanged)
    └── ...
```

**Key point:** The `(marketing)` route group shares zero layout with the `(app)` group. Marketing pages render the Norse marketing shell; app pages render the dashboard shell. They are isolated.

---

### Migration Path for Existing Static Files

Existing static files should be **preserved and redirected** — not deleted. This protects any existing inbound links (Google, Reddit mentions, direct URLs):

```typescript
// next.config.js — redirects for old URLs
redirects: [
  { source: '/static', destination: '/', permanent: true },
  { source: '/static/index.html', destination: '/', permanent: true },
  { source: '/static/privacy.html', destination: '/privacy', permanent: true },
  { source: '/static/terms.html', destination: '/terms', permanent: true },
  { source: '/sessions', destination: '/blog', permanent: true },
  { source: '/sessions/:slug', destination: '/blog/:slug', permanent: true },
]
```

Old static files can remain in `public/` until all redirects are verified working in production.

---

## 5. Dev Blog Integration (`/sessions/` → `/blog`)

### Current State
- 16 session HTML files in `development/frontend/public/sessions/`
- Shared `chronicle.css` for styling
- `sessions/index.html` is a hand-maintained index
- Each entry is a manually-crafted HTML file; no CMS or templating

### Recommended Approach

**Phase 1 (immediate):** Add `canonical` meta tags to existing `/sessions/*.html` pointing to future `/blog/:slug` URLs. This tells search engines the new URL is authoritative, before the redirect exists.

**Phase 2 (with the Next.js migration):** Convert session entries to Markdown with frontmatter:

```markdown
---
title: "The Lean Wolf"
date: "2026-03-06"
acts: 5
files: 9
rune: "ᚢ"
excerpt: "The wolf sheds 77% of its context weight..."
---

[session content in MDX]
```

Store in `content/blog/` (or `designs/sessions/` for repo self-containment). The blog list page reads all markdown files, sorts by date, generates the chronicle index. Individual pages use `generateStaticParams` to produce static HTML at build time.

**Why MDX over raw HTML:** Allows inline React components (callouts, code blocks with syntax highlight, rune decorations) without hand-coding HTML. Still compiles to static HTML.

**Authoring workflow:** New sessions continue as Claude-generated content, but written in Markdown instead of raw HTML. FiremanDecko generates the file; the build handles the HTML.

---

## 6. Legal Pages Integration

### Current State
- `/static/privacy.html` and `/static/terms.html` are standalone styled HTML files
- They use the same design tokens (Cinzel, Source Serif 4, `--void`, `--gold`) as the marketing site
- Linked from the home page footer: `<a href="/static/privacy.html">Privacy Policy</a>`

### Recommended Migration

Move both pages to the `(marketing)` route group as Next.js pages:

- `app/(marketing)/privacy/page.tsx` → renders at `/privacy`
- `app/(marketing)/terms/page.tsx` → renders at `/terms`

Both pages use the marketing `layout.tsx` shell (nav + footer), which is appropriate — legal pages should look like the marketing site, not the app.

Redirect `/static/privacy.html` → `/privacy` and `/static/terms.html` → `/terms` via `next.config.js`.

**Legal content management:** Keep the policy text in the page files (not a CMS). These documents change rarely and are safer as code-reviewed file changes than CMS edits.

---

## 7. Norse/Wolf Branding Elements to Carry Forward

The existing marketing site has a coherent, distinctive Saga Ledger aesthetic. All elements below are defined in CSS custom properties and must be preserved across all new pages.

### Typography
| Variable | Value | Use |
|----------|-------|-----|
| `--font-display` | Cinzel Decorative | H1, logo wordmark, section hero rune-words |
| `--font-heading` | Cinzel | H2, H3, nav links, feature names |
| `--font-body` | Source Serif 4 | Body text, descriptions, legal copy |
| `--font-mono` | JetBrains Mono | Code, technical specs, changelog entries |

### Color Palette
| Variable | Hex | Meaning |
|----------|-----|---------|
| `--void` | `#12100e` | Page background — deep forge-stone |
| `--gold` | `#d4a520` | Primary accent — reward, Valhalla, CTAs |
| `--gold-bright` | `#f0c040` | Hover states, highlights |
| `--ice-blue` | `#5b9ec9` | Wolf's eyes — atmospheric accent only |
| `--text-saga` | `#f0ede4` | Primary text — warm parchment white |
| `--text-rune` | `#a09888` | Secondary text — dimmer, stone-like |
| `--teal-asgard` | `#0a8c6e` | Success / active states |
| `--amber-hati` | `#f59e0b` | Warning / expiring states |
| `--fire-muspel` | `#c94a0a` | Danger / overdue states |

### Norse Linguistic Elements
- **Runic alphabet decorations:** ᚠᛖᚾᚱᛁᚱ used as visual separators and section markers
- **Mythology-named features:** Sköll & Hati, Norns' Weave, Valhalla, The Howl, Nine Realms — all with Wikipedia links per current convention
- **Gleipnir mythology:** The wolf bound by impossible chains = credit card companies binding cardholders. This metaphor is the brand's core.
- **Terminology:** "forge", "carved", "inscribed", "rune-stone", "saga", "chronicle" — NOT "scroll", "parchment", "document"
- **Voice:** Mythic but direct. "The wolf watches what the issuers hope you forget."

### Visual Texture Elements
- Stone grain SVG noise texture (fractalNoise) applied to backgrounds
- Radial gold glow at page top (subtle)
- `--radius: 3px` (minimal rounding — stone doesn't curve)
- Section dividers: single-pixel `--border` lines with rune characters

### What to Avoid on New Pages
- Rounded cards (border-radius > 4px feels wrong for the aesthetic)
- Light backgrounds (the dark forge aesthetic is load-bearing for brand identity)
- Sans-serif body text (breaks the saga voice)
- Emoji (Norse gods do not use emoji)
- Generic SaaS copy ("unlock your potential", "empower teams", etc.)

---

## 8. Summary Recommendation — Design Brief for Luna + FiremanDecko

### Phase 1: Next.js Marketing Shell (Sprint 6–7 target)

**What to build:**
1. `app/(marketing)/layout.tsx` — shared nav (Features, Pricing, Blog) + footer with legal links
2. `app/(marketing)/page.tsx` — migrate existing `index.html` content; preserve all copy and sections
3. `app/(marketing)/features/page.tsx` — expanded feature breakdown, one section per named feature
4. `app/(marketing)/pricing/page.tsx` — Thrall vs Karl tier table, FAQ section at bottom
5. `app/(marketing)/privacy/page.tsx` and `/terms/page.tsx` — migrate legal content
6. `next.config.js` redirects for all old `/static/*` and `/sessions/*` URLs

**For Luna:**
- Design the shared marketing nav component (desktop + mobile)
- Design the Features page layout (Norse-appropriate section rhythm, not generic SaaS grid)
- Design the Pricing page (Thrall / Karl comparison — must feel earned, not cheap)
- All wireframes should use the existing Saga Ledger palette and typography — no new design tokens needed

**For FiremanDecko:**
- Implement `(marketing)` route group with shared layout
- Extract existing `index.html` CSS variables into a shared `marketing-tokens.css` or Tailwind config extension
- Add `next-sitemap` for automatic sitemap generation
- Set up redirects in `next.config.js`

### Phase 2: Blog Migration (Sprint 8 target)

1. Convert all 16 `/sessions/*.html` files to Markdown in `content/blog/`
2. Build `app/(marketing)/blog/page.tsx` — dynamic list from markdown files
3. Build `app/(marketing)/blog/[slug]/page.tsx` — static generation from markdown
4. Preserve all runic styling from `chronicle.css` as Tailwind classes or CSS modules

### Phase 3: FAQ + Changelog (Sprint 9 target)

1. `app/(marketing)/faq/page.tsx` — seed with 10-12 questions from Reddit DPs
2. `app/(marketing)/changelog/page.tsx` — markdown-driven release notes
3. Both pages should be markdown-file-driven for easy Odin/Freya edits without code changes

---

### Key Constraints

- **Do not** create a separate Vercel project or subdomain for marketing — keep it in the main Next.js app
- **Do not** use a CMS (Contentful, Sanity, etc.) — markdown files in the repo are sufficient for this scale
- **Do not** break existing `/sessions/` or `/static/` URLs until redirects are verified working
- **Do not** ship pricing page without pricing being finalized — a placeholder is worse than no page
- Marketing pages must have `export const dynamic = 'force-static'` to ensure Vercel serves them as static HTML, not SSR

---

*Research by FiremanDecko · Ref #180 · 2026-03-08*
