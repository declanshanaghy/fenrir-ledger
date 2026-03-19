# ⚔️ Fenrir Ledger — Quality Report

**Generated:** 3/19/2026, 01:13:20 UTC · **157 test files** · **2225 test cases**

<div align="center">

## ᚦ F O R M A L &nbsp; C H A N G E &nbsp; O R D E R ᚦ

*Issued by Loki Laufeyson, QA Tester · 2026-03-19*

</div>

| | |
|:--|:--|
| **To** | Odin, All-Father |
| **From** | Loki Laufeyson, QA Tester |
| **Re** | Test Quality Deficiencies |

> *The chain has weak links. They must be reforged.*

**Deficiencies:**
- Combined line coverage at **48.0%** — below the 50% threshold

**Required Actions:**
1. Increase coverage to >=50% combined lines
2. Priority: auth flows, sync engine, import pipeline

> *I have seen worse — but not by much.*

<div align="center">

<svg width="280" height="140" viewBox="0 0 280 140" xmlns="http://www.w3.org/2000/svg">
  <rect x="1" y="1" width="278" height="138" rx="6" fill="#07070d" stroke="#c9920a" stroke-width="2"/>
  <line x1="20" y1="38" x2="260" y2="38" stroke="#c9920a" stroke-width="0.5" opacity="0.4"/>
  <text x="140" y="28" text-anchor="middle" font-family="serif" font-size="20" letter-spacing="8" fill="#c9920a">ᛚ ᛟ ᚲ ᛁ</text>
  <text x="140" y="62" text-anchor="middle" font-family="serif" font-size="14" fill="#e8e8e0">Loki Laufeyson</text>
  <text x="140" y="84" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#8b8680">QA Tester · Fenrir Ledger</text>
  <text x="140" y="106" text-anchor="middle" font-family="monospace" font-size="11" fill="#8b8680">2026-03-19</text>
  <text x="140" y="130" text-anchor="middle" font-family="serif" font-size="10" letter-spacing="3" fill="#c9920a" opacity="0.6">ᚠ ᛖ ᚾ ᚱ ᛁ ᚱ</text>
</svg>

*ᚠᛖᚾᚱᛁᚱ — the forge fires must be relit*

</div>

---

## 🐺 Test Quality Analysis

The shield wall is clean. No hollow tests detected — every assertion draws blood.

---

## 📊 Code Coverage

**48.0%** Vitest (combined not available) line coverage. Below 60%. The shield wall has holes. Priority gaps: auth flows, import pipeline, Firestore client.

> 🟢 ≥80% clean kill · 🟡 60–79% survivable wound · 🔴 <60% bleeding out

| Report | Source Files | Lines | Functions | Branches | Detail |
|--------|-------------:|-------|-----------|----------|--------|
| Combined | — | — | — | — | — |
| [Vitest](coverage/vitest/index.html) | 214 | 🔴 **48.0%** (3045/6340) | 🔴 **39.9%** (532/1334) | 🔴 **41.6%** (1843/4429) | [View →](coverage/vitest/index.html) |
| Playwright | — | — | — | — | — |

**What each report measures:**

- **[Combined](coverage/combined/index.html)** — merged Vitest + Playwright after stripping `.next/` artifacts. The canonical number. 
- **[Vitest](coverage/vitest/index.html)** — in-process unit + integration tests. Fast, precise, covers pure logic and API route handlers. 214 files.
- **[Playwright](coverage/playwright/index.html)** — server-side coverage from E2E runs. Captures SSR + API routes exercised through the browser. Client-rendered components appear at 0% unless they also run server-side. No data.

[View master coverage index →](coverage/index.html)

---

## 🗡️ Test Inventory

The pack runs **157 files** carrying **2225 tests**. Here is how the hunt is divided.

| Category | Files | Tests | Share | What it guards |
|----------|------:|------:|------:|----------------|
| **Unit** | 40 | 952 | 42.8% | Pure logic, lib/, utilities — no render, no HTTP |
| **Hook** | 11 | 131 | 5.9% | React hooks (useCloudSync, useEntitlement, etc.) |
| **Component** | 43 | 509 | 22.9% | React component render tests (.tsx) |
| **API / Route** | 55 | 613 | 27.6% | Route handlers, auth middleware, integration |
| **E2E (Playwright)** | 8 | 20 | 0.9% | End-to-end browser tests in quality/test-suites/ |

### Unit — 40 files · 952 tests · ✅ clean

Pure logic. No mocks of the world — only functions and their returns. The fastest tests in the pack.

**Top areas by test count:**

- `(root)/` — 484 tests
- `lib/` — 381 tests
- `analytics/` — 44 tests
- `sheets/` — 18 tests
- `coverage/` — 12 tests

### Hook — 11 files · 131 tests · ✅ clean

React hooks under fire. State transitions, side effects, and async edge cases — tested without a browser.

**Top areas by test count:**

- `hooks/` — 131 tests

### Component — 43 files · 509 tests · ✅ clean

Components rendered in isolation. Interaction, conditional rendering, accessibility — the UI layer under scrutiny.

**Top areas by test count:**

- `components/` — 296 tests
- `karl-bling/` — 84 tests
- `household/` — 39 tests
- `ledger/` — 38 tests
- `layout/` — 28 tests

### API / Route — 55 files · 613 tests · ✅ clean

Route handlers, auth middleware, and integration flows. The gates of the realm. If these fall, nothing is safe.

**Top areas by test count:**

- `trial/` — 130 tests
- `auth/` — 109 tests
- `stripe/` — 90 tests
- `household/` — 89 tests
- `sync/` — 79 tests

### E2E (Playwright) — 8 files · 20 tests · ✅ clean

Full browser runs against the live app. Slow, expensive, and the closest thing to a real user. Use sparingly.

**Top areas by test count:**

- `auth/` — 9 tests
- `card-lifecycle/` — 7 tests
- `auth-returnto/` — 4 tests

---

*Generated by `quality/scripts/quality-report.mjs` · [Coverage index](coverage/index.html)*