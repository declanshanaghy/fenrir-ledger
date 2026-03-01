# ADR-001: Tech Stack — Next.js + TypeScript + Tailwind CSS + shadcn/ui

## Status: Accepted

## Context

Fenrir Ledger is a personal finance web app for credit card churners. Sprint 1 targets local-only use (no backend, no auth), with Vercel hosting coming in a future sprint. We need a frontend stack that:

- Enables fast iteration on UI-heavy features (cards, dashboards, forms)
- Produces a production-quality codebase from day one
- Runs entirely in the browser for Sprint 1 (localStorage persistence)
- Has a clear path to server-side features when the backend is introduced
- Is mobile-responsive (churners check this on the go)
- Has strong TypeScript support for data model correctness

The team has also decided that the Next.js project root will live at `development/frontend/` so the monorepo can host architecture docs, team SKILLs, and source code alongside each other without collision. Vercel will be configured with Root Directory set to `development/frontend/`.

## Options Considered

### 1. Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui (chosen)

**Pros**:
- Next.js App Router is the current React meta-framework standard; file-based routing, server components, and API routes are built in — we can adopt them incrementally
- TypeScript eliminates a class of runtime bugs in data model handling (critical when tracking financial dates and amounts)
- Tailwind CSS enables rapid, consistent styling without a large CSS surface to maintain
- shadcn/ui provides accessible, unstyled-but-beautiful components (cards, dialogs, forms, badges) that map directly to our UI needs; components are copy-owned, not library-locked
- Vercel is the natural deploy target for Next.js — zero additional config when we add hosting
- Strong community support and long-term viability

**Cons**:
- App Router has a learning curve for developers used to Pages Router
- shadcn/ui requires manual installation steps (not a single `npm install`)
- Build output is a Node.js server by default (but can be statically exported for Sprint 1 if needed)

### 2. Create React App + TypeScript + CSS Modules

**Pros**: Simpler mental model, no server rendering concepts in Sprint 1.

**Cons**: CRA is officially unmaintained. No upgrade path to SSR/API routes. More boilerplate for routing. Loses Vercel zero-config advantage.

### 3. Vite + React + TypeScript + Tailwind

**Pros**: Fast builds, simple config, lightweight.

**Cons**: No built-in routing, API routes, or SSR. Would require adding a router (React Router v7) and later stitching in a backend separately. More migration friction when adding server features.

### 4. Remix + TypeScript + Tailwind

**Pros**: Excellent data loading model, good TypeScript support.

**Cons**: Less familiar to most frontend developers. Smaller shadcn/ui integration story. Vercel support is good but Next.js is the primary Vercel-optimized framework.

## Decision

Use **Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui**, scaffolded via `create-next-app` with:

```
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Run from within `development/frontend/`. This produces the correct project root structure.

shadcn/ui is initialized after scaffolding with `npx shadcn@latest init`.

## Consequences

**Positive**:
- Consistent type safety across the data model from Sprint 1 onward
- Tailwind + shadcn/ui enables rapid, accessible UI development
- App Router provides the foundation for API routes and server components in future sprints
- Vercel deploy in a future sprint requires zero additional framework configuration
- shadcn/ui components are copy-owned — no dependency drift, no breaking upgrades

**Negative**:
- App Router concepts (Server vs. Client Components) must be understood from Sprint 1 to avoid footguns. Rule: mark components that use `useState`, `useEffect`, or browser APIs with `"use client"`.
- shadcn/ui installation is a manual multi-step process — documented in `development/implementation-plan.md`
- TypeScript strictness requires careful typing of localStorage deserialization paths

**Constraints introduced**:
- All components that use React hooks or browser APIs must include `"use client"` at the top
- The `development/frontend/` directory is the Next.js project root — all `npm` commands run from there
- Vercel Root Directory must be set to `development/frontend/` when hosting is configured
