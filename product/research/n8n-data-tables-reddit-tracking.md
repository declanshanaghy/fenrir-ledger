# Research: n8n Data Tables for Reddit Campaign Tracking

**Issue:** #2128
**Author:** Freya (Product Owner)
**Date:** 2026-04-05
**Status:** COMPLETE

---

## Summary

This document assesses whether n8n Data Tables can serve as the persistence layer for tracking Reddit community engagement activity (comments posted, replies received, subreddit performance) and cross-referencing with Umami analytics. The conclusion is a **conditional yes**: Data Tables are well-suited for this use case given current volumes, require zero external infrastructure, and integrate directly into our existing n8n workflows with minimal overhead.

---

## 1. What Are n8n Data Tables?

n8n Data Tables (released in n8n v1.113) are a built-in, structured data storage system that lives inside the n8n instance. They use **SQLite** as the underlying storage engine — data is stored in a local file on the n8n server.

Key characteristics:
- **Native to n8n** — no external database, no credentials, no network calls
- **Structured, tabular** — rows and columns with typed fields (Text, Number, Date, Boolean)
- **Persistent** — data survives between workflow executions
- **Fast** — ~8ms single insert, ~15ms to query 100 rows (vs ~1,000ms for Google Sheets)
- **Self-hosted requirement** — requires `N8N_ENABLED_MODULES=data-table` environment variable

---

## 2. Capabilities Relevant to Reddit Tracking

### 2.1 Supported Operations

The Data Table node provides 7 operations:

| Operation | Description |
|-----------|-------------|
| Insert | Creates new row; fails if primary key exists |
| Update | Modifies rows matching filter criteria |
| Delete | Removes rows by filter |
| **Upsert** | Inserts or updates based on match column (idempotent — ideal for deduplication) |
| Get Many | Retrieves rows with optional filter, sort, pagination |
| Get One | Returns single matching row |
| Optimize Bulk | High-performance batch inserts (no return data) |

### 2.2 Column Types

- **Text** — subreddit name, post URL, comment text, Reddit username
- **Number** — upvotes, reply count, karma at time of posting
- **Date** — timestamps (posted_at, replied_at)
- **Boolean** — is_reply, product_mentioned, reply_drafted

### 2.3 Storage Limits

| Limit | Default | Configurable |
|-------|---------|-------------|
| Total storage (all tables) | 50MB | Yes, via `N8N_DATA_TABLES_MAX_SIZE_BYTES` |
| Practical row capacity at 50MB | 200,000–500,000 simple records | N/A |
| Per-table row limit | None stated | N/A |

**Verdict for Reddit tracking:** At a pace of 1–5 comments per day, this workload generates ~1,500–9,000 records per year. 50MB capacity is effectively unlimited for this use case.

### 2.4 Query Capabilities

- **Filtering** — equality and comparison filters on any column
- **Sorting** — ascending/descending on any column
- **Pagination** — configurable row limits for batch processing
- **Upsert matching** — deduplication by any column (e.g., `reddit_comment_id`)

**Limitations:**
- No SQL JOIN operations (single-table queries only)
- No full-text search
- No aggregation functions (GROUP BY, SUM, COUNT) within the node itself
- Aggregation requires downstream Code node logic

### 2.5 Export / Import

- Data can be exported from the n8n UI (Data table tab)
- Export format: CSV (suitable for Umami cross-reference in spreadsheets)
- API access via the DataTable API endpoint for programmatic exports

---

## 3. Existing n8n Reddit Workflows

Two workflows are currently deployed in `/infrastructure/n8n/workflows/`:

### `gmail-reddit-monitor.json`
**Purpose:** Monitors Gmail for Reddit reply notifications. Detects whether each email is a reply to our comment or a suggested post in a preferred subreddit. Routes to Claude for draft generation.

**Nodes of interest for Data Tables integration:**
- `Extract — Reply Context` — parses `messageId`, `threadId`, `date`, `replierName`, `subreddit`, `replyText`, `replyLink`
- `Extract — Suggested Posts` — parses subreddit, post context, and URL from F5Bot-suggested posts
- `Claude — Draft Reply` / `Claude — Draft Comment` — generates response text

**Current gap:** The workflow drafts replies but **does not log anything persistently**. Once a workflow execution ends, all data is gone.

### `gmail-f5bot-monitor.json`
**Purpose:** Monitors F5Bot keyword alert emails for mentions of Fenrir-relevant terms on Reddit. Extracts Reddit URLs and drafts comment text via Claude.

**Current gap:** Same as above — no persistence layer. Activity is undocumented after execution.

---

## 4. Proposed Schema

### Table 1: `reddit_comments_posted`
Tracks every comment/reply we post (or prepare to post).

| Column | Type | Notes |
|--------|------|-------|
| `id` | Text (PK) | Reddit comment ID (from API) or generated UUID for drafts |
| `created_at` | Date | Timestamp when logged |
| `subreddit` | Text | e.g., `r/churning` |
| `post_url` | Text | Reddit thread URL |
| `comment_text` | Text | Full text of our comment |
| `comment_type` | Text | `reply` or `new_comment` |
| `source_workflow` | Text | `gmail-reddit-monitor` or `gmail-f5bot-monitor` |
| `product_mentioned` | Boolean | Did we mention Fenrir? |
| `phase` | Text | `phase1` or `phase2` |
| `status` | Text | `drafted`, `posted`, `skipped` |

### Table 2: `reddit_replies_received`
Tracks replies to our comments.

| Column | Type | Notes |
|--------|------|-------|
| `id` | Text (PK) | Gmail `messageId` for deduplication |
| `created_at` | Date | Timestamp when reply received |
| `subreddit` | Text | e.g., `r/creditcards` |
| `replier_name` | Text | Reddit username of replier |
| `reply_text` | Text | Snippet of their reply (max 1000 chars) |
| `reply_link` | Text | Direct link to their reply |
| `our_comment_id` | Text | FK reference to `reddit_comments_posted.id` (manual cross-ref) |
| `reply_drafted` | Boolean | Did we draft a follow-up? |
| `sentiment` | Text | `positive`, `neutral`, `negative` (can be Claude-classified) |

### Table 3: `reddit_engagement_daily`
Aggregated daily metrics (written by a scheduled summary workflow).

| Column | Type | Notes |
|--------|------|-------|
| `date` | Text (PK) | ISO date `YYYY-MM-DD` |
| `subreddit` | Text | e.g., `r/churning` |
| `comments_posted` | Number | Count of comments that day |
| `replies_received` | Number | Count of replies received |
| `product_mentions` | Number | Count where `product_mentioned = true` |
| `umami_signups` | Number | Signups from Umami on that date (populated manually or via API) |

---

## 5. Integration Plan with Existing Workflows

### 5.1 gmail-reddit-monitor.json — Add Logging Nodes

After each successful draft creation, add a **Data Table — Upsert** node:

**For replies received:**
- After `Extract — Reply Context`, upsert into `reddit_replies_received`
- Match column: `id` (Gmail messageId) — prevents duplicate logging on re-runs

**For comments drafted:**
- After `Gmail — Create Reply Draft` or `Gmail — Create Comment Draft`, upsert into `reddit_comments_posted`
- Status: `drafted` initially; update to `posted` when manually confirmed

**Pattern:**
```
Extract — Reply Context
  → Data Table: Upsert → reddit_replies_received
  → Filter — Reply Not Ignored
    → Claude — Draft Reply
      → Gmail — Create Reply Draft
        → Data Table: Update reddit_replies_received SET reply_drafted=true
```

### 5.2 gmail-f5bot-monitor.json — Add Logging Nodes

After `Claude — Draft Comment`, upsert into `reddit_comments_posted`:
- `comment_type = new_comment`
- `source_workflow = gmail-f5bot-monitor`
- `status = drafted`

### 5.3 New: Daily Aggregation Workflow

A separate scheduled workflow (runs nightly) reads `reddit_comments_posted` and `reddit_replies_received`, computes daily totals per subreddit, and upserts into `reddit_engagement_daily`. This is the table cross-referenced against Umami.

---

## 6. Cross-Reference Strategy with Umami

Umami tracks page views and custom events on the Fenrir Ledger site. The cross-reference goal is: **did Reddit activity on day X correlate with signups/traffic on day X+N?**

### Approach A — Manual CSV export (immediate, no code)
1. Export `reddit_engagement_daily` as CSV from n8n Data Table tab
2. Export Umami "Custom Events" (signup events) for same date range
3. Join in Google Sheets by date column
4. Calculate: correlation between `comments_posted` and `umami_signups`

**Verdict:** Best starting point. Requires no additional engineering.

### Approach B — Umami API integration (medium effort)
Umami exposes a REST API (`/api/websites/{id}/stats`). A nightly n8n workflow could:
1. Call Umami API for previous day's signup count
2. Write result to `reddit_engagement_daily.umami_signups`

This makes the Data Table the single source of truth for correlation analysis.

### Approach C — External DB (overkill for current scale)
A Postgres or Firestore table would offer full SQL aggregation. Not needed until volume exceeds n8n Data Tables' practical capacity (~200K rows) or JOIN queries are required.

---

## 7. Limitations and Risk Assessment

| Limitation | Impact | Mitigation |
|-----------|--------|------------|
| No JOIN queries | Can't cross-reference tables in-node | Use Code node for in-memory joins; export CSV for spreadsheet analysis |
| No COUNT/GROUP BY in node | Can't aggregate directly in Data Table node | Write aggregation logic in Code node, store results in `reddit_engagement_daily` |
| No full-text search | Can't search comment content | Filter by subreddit + date range is sufficient for this use case |
| 50MB default storage | ~500K rows max | At current pace (~5 comments/day), this won't be reached for 270+ years |
| Data is local to n8n instance | Data lost if n8n instance is replaced without backup | Docker volume at `/home/node/.n8n` must be persisted in GKE; or export to Firestore periodically |
| No native data retention policy | Old rows accumulate indefinitely | Implement a cleanup workflow (DELETE rows older than 2 years) |
| Requires `N8N_ENABLED_MODULES=data-table` | Must be set in n8n GKE deployment env vars | One-time infra change; low risk |

---

## 8. Recommendation

**USE n8n Data Tables.** The recommendation is straightforward:

| Criterion | Assessment |
|-----------|-----------|
| Capability fit | High — all required operations are supported |
| Volume fit | High — current scale is <1% of capacity |
| Integration effort | Low — adds ~2 nodes per existing workflow |
| Operational overhead | Low — no external database to manage |
| Cross-reference with Umami | Medium — manual CSV export now, API integration later |
| Risk | Low — data loss only if GKE volume is not persisted (mitigable) |

**Do not use an external DB** (Postgres, Firestore) at this stage. The overhead is unjustified for <10 records/day. Revisit at Week 12 automation evaluation checkpoint.

**Do not skip tracking.** The current workflows produce zero persistent data. Without logging, there is no basis for measuring campaign effectiveness, justifying automation investment, or attributing signups to Reddit activity.

---

## 9. Acceptance Criteria Check

- [x] Summary of n8n Data Tables capabilities and limitations — Section 2
- [x] Recommendation: use Data Tables, use external DB, or skip — Section 8 (USE Data Tables)
- [x] Proposed schema/table structure for Reddit tracking — Section 4
- [x] Integration plan with existing n8n Reddit workflows — Section 5
- [x] Cross-reference strategy with Umami — Section 6

---

## 10. Next Steps (for Engineering handoff)

1. **Add `N8N_ENABLED_MODULES=data-table` to n8n GKE deployment** (`infrastructure/k8s/`)
2. **Verify GKE volume persistence** for n8n's `/home/node/.n8n` data directory
3. **Create the three tables** in n8n UI (or via workflow bootstrap)
4. **Add Data Table upsert nodes** to `gmail-reddit-monitor.json` and `gmail-f5bot-monitor.json`
5. **Build daily aggregation workflow** (new n8n workflow)
6. **Manual CSV export + Umami cross-reference** as first reporting cycle

---

## References

- [n8n Data Tables Docs](https://docs.n8n.io/data/data-tables/)
- [n8n Data Table Node Docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.datatable/)
- [n8n Community: Data Tables Launch](https://community.n8n.io/t/data-tables-are-here/192256)
- [n8n Community: 50MB Limit Discussion](https://community.n8n.io/t/i-see-that-the-datatables-only-have-a-50mb-limit-is-there-a-way-to-offload-that-database-to-increase-storage-limits/233603)
- [LogicWorkflow: Data Table Node Guide](https://logicworkflow.com/nodes/data-table-node/)
- Existing workflows: `infrastructure/n8n/workflows/gmail-reddit-monitor.json`, `gmail-f5bot-monitor.json`
- Reddit engagement strategy: `product/target-market/README.md`
