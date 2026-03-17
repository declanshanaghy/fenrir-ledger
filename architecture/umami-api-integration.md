# Umami Analytics API Integration — n8n Marketing Loop

**Status**: Research Complete | **Owner**: FiremanDecko | **Ref**: Issue #1180
**Last updated**: 2026-03-17

> This document covers the Umami v2 REST API, authentication, endpoint reference, PostgreSQL
> schema for `marketing_metrics`, n8n workflow design, rate limit guidance, and Reddit campaign
> KPI mapping. It is the primary deliverable for the automated marketing loop (#1179).

**Related documents:**
- `architecture/n8n-reddit-automation.md` — Reddit monitoring + drafting workflows
- `product/target-market/README.md` — Reddit strategy and success metrics

---

## 1. Deployment Context

| Property | Value |
|---|---|
| Umami instance | `https://analytics.fenrirledger.com` |
| Website ID | `ce25059e-57c4-44f9-ad92-389d2bd15e4d` |
| Umami version | v2 (self-hosted, Next.js) |
| n8n host | cork.lan (ref: issue #442) |
| PostgreSQL host | cork.lan (same n8n stack) |

---

## 2. Authentication

### 2.1 Self-Hosted: Bearer Token (Only Method)

Self-hosted Umami does **not** support the `x-umami-api-key` header — that is a Umami Cloud
feature handled upstream of the application. For `analytics.fenrirledger.com`, the only
authentication method is a **JWT bearer token** obtained via `/api/auth/login`.

**Step 1 — Obtain token:**

```http
POST https://analytics.fenrirledger.com/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "<password>"
}
```

Response:
```json
{
  "token": "eyJ...<jwt>",
  "user": {
    "id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "username": "admin",
    "role": "admin",
    "isAdmin": true
  }
}
```

**Step 2 — Use token in all API calls:**

```http
Authorization: Bearer eyJ...<jwt>
```

**Step 3 — Verify token is still valid:**

```http
POST https://analytics.fenrirledger.com/api/auth/verify
Authorization: Bearer eyJ...<jwt>
```

Returns the user object on success; 401 if expired.

### 2.2 n8n Credential Configuration

In n8n on cork.lan:

1. **Settings → Credentials → New** → choose **"Header Auth"**
2. Name: `Umami Analytics`
3. Header Name: `Authorization`
4. Header Value: `Bearer <jwt-token>`

**Token lifetime**: Umami's JWT does not have a short TTL by default (the expiry depends on
`APP_SECRET` and session configuration). Store the token in n8n credentials. If API calls
return 401, re-run the login workflow to refresh the token and update the credential.

**Recommended pattern**: Add a sub-workflow in n8n that calls `/api/auth/login` and updates
the stored credential. Trigger it manually or on a weekly schedule.

---

## 3. API Endpoint Reference

**Base URL:** `https://analytics.fenrirledger.com/api`

All responses are JSON. All timestamps use **Unix milliseconds** (not seconds) for `startAt`
and `endAt`.

### 3.1 Shared Query Parameters

All stat endpoints accept these parameters:

**Date range:**

| Parameter | Type | Description |
|---|---|---|
| `startAt` | number (ms) | Start timestamp in Unix milliseconds |
| `endAt` | number (ms) | End timestamp in Unix milliseconds |
| `timezone` | string | IANA timezone, e.g. `America/New_York` |
| `unit` | string | Bucket size: `minute`, `hour`, `day`, `month`, `year` |
| `compare` | string | `"prev"` (prior period) or `"yoy"` (year-over-year) |

**Filters (available on all stat endpoints):**

| Parameter | Description |
|---|---|
| `path` | URL path filter |
| `referrer` | Referrer domain |
| `os` | Operating system |
| `browser` | Browser name |
| `device` | Device type (`desktop`, `mobile`, `tablet`) |
| `country` | Country code |
| `region` | Region |
| `city` | City |
| `language` | Browser language |
| `event` | Event name |
| `eventType` | `1`=pageview, `2`=customEvent, `3`=linkEvent |

---

### 3.2 `GET /api/websites/{id}/stats`

Summary statistics for the date range. Use for daily/weekly rollup.

**Parameters:** `startAt`, `endAt`, `timezone`, plus filter params.

**Example request:**
```
GET /api/websites/ce25059e-57c4-44f9-ad92-389d2bd15e4d/stats
    ?startAt=1741737600000
    &endAt=1741823999000
Authorization: Bearer <token>
```

**Response:**
```json
{
  "pageviews": 12345,
  "visitors": 4200,
  "visits": 5600,
  "bounces": 1800,
  "totaltime": 98765432
}
```

| Field | Description |
|---|---|
| `pageviews` | Total pageview events in range |
| `visitors` | Unique visitors (by session fingerprint) |
| `visits` | Unique sessions |
| `bounces` | Sessions with exactly one pageview |
| `totaltime` | Sum of session durations (milliseconds) |

> Note: Custom events are excluded from these counts.

---

### 3.3 `GET /api/websites/{id}/pageviews`

Time-series pageview and session counts, bucketed by `unit`.

**Parameters:** All shared params. `unit` and `timezone` control bucketing.

**Response:**
```json
{
  "pageviews": [
    { "x": "2026-03-17 00:00:00", "y": 342 },
    { "x": "2026-03-16 00:00:00", "y": 418 }
  ],
  "sessions": [
    { "x": "2026-03-17 00:00:00", "y": 189 },
    { "x": "2026-03-16 00:00:00", "y": 231 }
  ]
}
```

Each array item: `x` = timestamp bucket string, `y` = integer count.

---

### 3.4 `GET /api/websites/{id}/metrics`

Dimensional breakdown — the primary endpoint for referrer, UTM, and custom event analysis.

**Additional parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | string | Yes | Dimension to break down by (see table below) |
| `limit` | integer | No | Max rows (default 500) |
| `offset` | integer | No | Pagination offset |
| `search` | string | No | ILIKE filter on dimension value |

**`type` values relevant to marketing:**

| `type` value | Description | Use case |
|---|---|---|
| `referrer` | Referrer domain breakdown | See traffic sources by domain |
| `path` | URL path breakdown | Top landing pages |
| `query` | Raw URL query string | Contains UTM params as raw strings |
| `event` | Custom event names | Conversion events, CTA clicks |
| `country` | Country codes | Geographic distribution |
| `device` | Device types | Desktop vs mobile split |
| `browser` | Browser names | Browser distribution |
| `os` | Operating systems | OS distribution |
| `entry` | Entry pages (first page of visit) | Landing page effectiveness |
| `exit` | Exit pages (last page of visit) | Drop-off analysis |

**UTM note:** UTM parameters (`utm_source`, `utm_campaign`, etc.) are stored as part of the
URL query string and captured in `url_query` in the database. Access them via `type=query`.
The raw query strings will look like `?utm_source=reddit&utm_campaign=churning-apr-2026`. To
extract per-UTM-param breakdowns, use the `/api/reports/utm` endpoint (Umami v2.10+) or
parse the raw query values from `type=query` results in the n8n workflow.

**Response:**
```json
[
  { "x": "reddit.com", "y": 840 },
  { "x": "google.com", "y": 620 },
  { "x": "direct", "y": 310 }
]
```

`x` = dimension value, `y` = count, ordered by `y` descending.

---

### 3.5 `GET /api/websites/{id}/events/series`

Time-series breakdown of custom event counts by event name and time bucket.

**Parameters:** `startAt` (required), `endAt` (required), `unit`, `timezone`, plus filter params.

**Response:**
```json
[
  { "x": "signup-click",  "t": "2026-03-17 00:00:00", "y": 42 },
  { "x": "trial-start",   "t": "2026-03-17 00:00:00", "y": 18 },
  { "x": "upgrade-click", "t": "2026-03-17 00:00:00", "y": 7 }
]
```

`x` = event name, `t` = time bucket, `y` = count.

---

### 3.6 `GET /api/websites/{id}/events`

Paginated log of individual events (all types: pageviews + custom events).

**Parameters:** `startAt`, `endAt`, filter params, `page`, `pageSize`.

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "websiteId": "ce25059e-57c4-44f9-ad92-389d2bd15e4d",
      "sessionId": "uuid",
      "createdAt": "2026-03-17T12:34:56.000Z",
      "hostname": "fenrirledger.com",
      "urlPath": "/pricing",
      "urlQuery": "?utm_source=reddit&utm_campaign=churning-apr-2026",
      "referrerDomain": "reddit.com",
      "country": "US",
      "device": "desktop",
      "browser": "Chrome",
      "eventType": 1,
      "eventName": null
    }
  ],
  "count": 1,
  "page": 1,
  "pageSize": 20
}
```

---

### 3.7 `GET /api/websites/{id}/active`

Real-time visitors in the last 5 minutes. No query parameters.

**Response:**
```json
{ "visitors": 5 }
```

---

## 4. PostgreSQL Schema: `marketing_metrics`

The n8n workflow inserts one row per metric/dimension value per time bucket.

```sql
CREATE TABLE IF NOT EXISTS marketing_metrics (
  id            BIGSERIAL PRIMARY KEY,
  captured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- when n8n inserted this row
  period_start  TIMESTAMPTZ NOT NULL,                  -- startAt of Umami query
  period_end    TIMESTAMPTZ NOT NULL,                  -- endAt of Umami query
  metric_type   VARCHAR(64)  NOT NULL,                 -- 'stats', 'pageviews', 'referrer',
                                                       -- 'utm_query', 'event_series', etc.
  channel       VARCHAR(64),                           -- 'reddit', 'google', 'direct', etc.
  source        VARCHAR(256),                          -- dimension value (x field from Umami)
  value         NUMERIC NOT NULL,                      -- count (y field from Umami)
  unit          VARCHAR(16),                           -- 'day', 'hour', 'week', 'month'
  time_bucket   TIMESTAMPTZ,                           -- for time-series rows (x from pageviews)
  raw_json      JSONB,                                 -- full Umami response row for this entry
  CONSTRAINT uq_metric_bucket UNIQUE (metric_type, source, period_start, period_end, time_bucket)
);

CREATE INDEX idx_marketing_metrics_period ON marketing_metrics (period_start, period_end);
CREATE INDEX idx_marketing_metrics_type   ON marketing_metrics (metric_type);
CREATE INDEX idx_marketing_metrics_channel ON marketing_metrics (channel);
```

**Column guide:**

| Column | Example values | Notes |
|---|---|---|
| `metric_type` | `stats`, `referrer`, `utm_query`, `event_series`, `pageviews_daily`, `active` | Set by n8n workflow step |
| `channel` | `reddit`, `google`, `direct`, `email`, `unknown` | Derived from `source` in Transform step |
| `source` | `reddit.com`, `/pricing`, `?utm_source=reddit`, `signup-click` | Raw `x` value from Umami |
| `value` | `840`, `4200`, `18` | Raw `y` count from Umami |
| `unit` | `day`, `hour` | Only for time-series rows |
| `time_bucket` | `2026-03-17 00:00:00+00` | Parsed from `x` in pageviews/event_series |
| `raw_json` | `{"x":"reddit.com","y":840}` | Full Umami response object |

---

## 5. n8n Workflow Design

### 5.1 High-Level Flow

```
[Cron Trigger]
    |
    v
[Set Variables]        — period_start, period_end, website_id, base_url
    |
    v
[HTTP Request: stats]  — GET /stats → summary KPIs
    |
    v
[HTTP Request: referrer] — GET /metrics?type=referrer → traffic sources
    |
    v
[HTTP Request: utm_query] — GET /metrics?type=query → raw UTM strings
    |
    v
[HTTP Request: event_series] — GET /events/series → conversion event counts
    |
    v
[HTTP Request: pageviews_daily] — GET /pageviews → daily time-series
    |
    v
[Function: Transform]  — normalize + assign channel + build INSERT rows
    |
    v
[PostgreSQL: Insert]   — Upsert rows into marketing_metrics (ON CONFLICT DO UPDATE)
    |
    v
[IF: weekly?]          — only on Fridays
    |
    v
[Send Email]           — Weekly marketing summary to Freya + Odin
```

### 5.2 Node Configurations

#### Cron Trigger

```
Schedule: 0 6 * * *   (daily at 06:00 UTC)
Timezone: UTC
```

Runs once per day. For Reddit campaign data this is sufficient — UTM attribution is
complete within hours of a click, and Umami aggregates by day.

#### Set Variables Node

```json
{
  "websiteId": "ce25059e-57c4-44f9-ad92-389d2bd15e4d",
  "baseUrl": "https://analytics.fenrirledger.com/api",
  "periodEnd": "={{ Date.now() }}",
  "periodStart": "={{ Date.now() - 86400000 }}",
  "timezone": "UTC",
  "unit": "day"
}
```

#### HTTP Request: stats

```
Method: GET
URL: ={{ $vars.baseUrl }}/websites/{{ $vars.websiteId }}/stats
    ?startAt={{ $vars.periodStart }}
    &endAt={{ $vars.periodEnd }}
    &timezone={{ $vars.timezone }}
Auth: Credential → Umami Analytics (Header Auth)
Response format: JSON
```

#### HTTP Request: referrer

```
Method: GET
URL: ={{ $vars.baseUrl }}/websites/{{ $vars.websiteId }}/metrics
    ?startAt={{ $vars.periodStart }}
    &endAt={{ $vars.periodEnd }}
    &type=referrer
    &limit=50
Auth: Credential → Umami Analytics (Header Auth)
```

#### HTTP Request: utm_query

```
Method: GET
URL: ={{ $vars.baseUrl }}/websites/{{ $vars.websiteId }}/metrics
    ?startAt={{ $vars.periodStart }}
    &endAt={{ $vars.periodEnd }}
    &type=query
    &limit=200
Auth: Credential → Umami Analytics (Header Auth)
```

#### HTTP Request: event_series

```
Method: GET
URL: ={{ $vars.baseUrl }}/websites/{{ $vars.websiteId }}/events/series
    ?startAt={{ $vars.periodStart }}
    &endAt={{ $vars.periodEnd }}
    &unit={{ $vars.unit }}
    &timezone={{ $vars.timezone }}
Auth: Credential → Umami Analytics (Header Auth)
```

#### HTTP Request: pageviews_daily

```
Method: GET
URL: ={{ $vars.baseUrl }}/websites/{{ $vars.websiteId }}/pageviews
    ?startAt={{ $vars.periodStart }}
    &endAt={{ $vars.periodEnd }}
    &unit={{ $vars.unit }}
    &timezone={{ $vars.timezone }}
Auth: Credential → Umami Analytics (Header Auth)
```

#### Function: Transform

JavaScript transform node (n8n Code node):

```javascript
const periodStart = new Date($vars.periodStart).toISOString();
const periodEnd = new Date($vars.periodEnd).toISOString();

function channelFromSource(source) {
  if (!source) return 'unknown';
  const s = source.toLowerCase();
  if (s.includes('reddit')) return 'reddit';
  if (s.includes('google') || s.includes('bing') || s.includes('yahoo')) return 'search';
  if (s.includes('twitter') || s.includes('x.com')) return 'twitter';
  if (s.includes('email') || s.includes('substack')) return 'email';
  if (s === 'direct' || s === '') return 'direct';
  return 'other';
}

function channelFromUtmQuery(queryString) {
  try {
    const params = new URLSearchParams(queryString.replace(/^\?/, ''));
    const utmSource = params.get('utm_source') || '';
    return channelFromSource(utmSource);
  } catch { return 'unknown'; }
}

const rows = [];

// --- stats (one flat row) ---
const stats = $node['HTTP Request: stats'].json;
rows.push({
  metric_type: 'stats',
  channel: null,
  source: 'summary',
  value: stats.pageviews,
  unit: 'day',
  time_bucket: null,
  raw_json: JSON.stringify(stats),
  period_start: periodStart,
  period_end: periodEnd,
});

// --- referrer breakdown ---
const referrers = $node['HTTP Request: referrer'].json;
for (const item of referrers) {
  rows.push({
    metric_type: 'referrer',
    channel: channelFromSource(item.x),
    source: item.x,
    value: item.y,
    unit: null,
    time_bucket: null,
    raw_json: JSON.stringify(item),
    period_start: periodStart,
    period_end: periodEnd,
  });
}

// --- UTM query strings ---
const utmQueries = $node['HTTP Request: utm_query'].json;
for (const item of utmQueries) {
  rows.push({
    metric_type: 'utm_query',
    channel: channelFromUtmQuery(item.x),
    source: item.x,
    value: item.y,
    unit: null,
    time_bucket: null,
    raw_json: JSON.stringify(item),
    period_start: periodStart,
    period_end: periodEnd,
  });
}

// --- event series ---
const events = $node['HTTP Request: event_series'].json;
for (const item of events) {
  rows.push({
    metric_type: 'event_series',
    channel: null,
    source: item.x,   // event name
    value: item.y,
    unit: $vars.unit,
    time_bucket: new Date(item.t).toISOString(),
    raw_json: JSON.stringify(item),
    period_start: periodStart,
    period_end: periodEnd,
  });
}

// --- pageviews time-series ---
const pageviews = $node['HTTP Request: pageviews_daily'].json;
for (const item of pageviews.pageviews) {
  rows.push({
    metric_type: 'pageviews_daily',
    channel: null,
    source: 'pageviews',
    value: item.y,
    unit: $vars.unit,
    time_bucket: new Date(item.x).toISOString(),
    raw_json: JSON.stringify(item),
    period_start: periodStart,
    period_end: periodEnd,
  });
}
for (const item of pageviews.sessions) {
  rows.push({
    metric_type: 'sessions_daily',
    channel: null,
    source: 'sessions',
    value: item.y,
    unit: $vars.unit,
    time_bucket: new Date(item.x).toISOString(),
    raw_json: JSON.stringify(item),
    period_start: periodStart,
    period_end: periodEnd,
  });
}

return rows.map(r => ({ json: r }));
```

#### PostgreSQL: Upsert

```sql
INSERT INTO marketing_metrics
  (captured_at, period_start, period_end, metric_type, channel, source, value, unit, time_bucket, raw_json)
VALUES
  (NOW(), '{{ $json.period_start }}', '{{ $json.period_end }}', '{{ $json.metric_type }}',
   '{{ $json.channel }}', '{{ $json.source }}', {{ $json.value }},
   '{{ $json.unit }}', '{{ $json.time_bucket }}', '{{ $json.raw_json }}')
ON CONFLICT (metric_type, source, period_start, period_end, time_bucket)
DO UPDATE SET
  value      = EXCLUDED.value,
  raw_json   = EXCLUDED.raw_json,
  captured_at = NOW();
```

Connection: n8n PostgreSQL credential pointing to cork.lan Postgres instance.

---

## 6. Rate Limits and Polling Frequency

### 6.1 Self-Hosted Rate Limits

Umami v2 self-hosted has **no application-layer rate limiting**. There is no quota enforced
by the Umami app itself. Any rate limiting would be at the infrastructure layer (nginx
`limit_req`, Kubernetes Ingress annotations, or a CDN).

For `analytics.fenrirledger.com`:

- **Current rate limit**: None configured at application layer (verify with Odin if Ingress
  has `nginx.ingress.kubernetes.io/limit-rps` annotations set).
- **Safe polling**: 1 request per second is conservative and far below any likely infrastructure
  limit. The workflow makes ~5 API calls per run, so each daily run is effectively zero load.

### 6.2 Recommended Schedule

| Frequency | Use case | n8n cron |
|---|---|---|
| **Daily (default)** | Marketing dashboard, weekly reports | `0 6 * * *` |
| **Hourly** | Active campaign monitoring (e.g. during a Reddit post going viral) | `0 * * * *` |
| **Weekly** | Aggregate weekly KPI rollup | `0 8 * * 1` (Mondays 08:00 UTC) |
| **Realtime** | `/api/websites/{id}/active` only — current visitor count | `*/5 * * * *` |

**Recommendation**: Run the full workflow daily at 06:00 UTC. During active Reddit campaigns
(manually triggered), optionally run an hourly variant that only calls `/stats` and `/metrics?type=referrer`.

### 6.3 Date Range Strategy

For daily runs:
```
startAt = midnight (00:00 UTC) of previous day in Unix ms
endAt   = 23:59:59 UTC of previous day in Unix ms
```

This captures a complete calendar day and avoids partial-day data. Calculate in n8n:
```javascript
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
yesterday.setUTCHours(0, 0, 0, 0);
const startAt = yesterday.getTime();
const endAt   = yesterday.getTime() + 86399999;
```

---

## 7. Umami Metrics → Reddit Campaign KPIs

From `product/target-market/README.md`, the Reddit strategy success metrics for 90 days:

| Reddit KPI | Target | Umami Metric | Endpoint | Query |
|---|---|---|---|---|
| Signups from Reddit | 50+ | Visitors from `reddit.com` referrer | `/metrics?type=referrer` | Filter `x = "reddit.com"` |
| Reddit-sourced pageviews | — | Pageviews with referrer `reddit.com` | `/metrics?type=referrer` | `y` value for `reddit.com` |
| Reddit UTM clicks landing | — | Query strings with `utm_source=reddit` | `/metrics?type=query` | Filter `x` contains `utm_source=reddit` |
| /pricing page visits from Reddit | — | Path `/pricing` with referrer filter | `/metrics?type=path&referrer=reddit.com` | Top paths from reddit referrals |
| Conversion events (signup-click, trial-start) | — | Custom events by name | `/events/series` | Filter `x = "signup-click"` |
| Landing page entry rate | — | Entry page `/` and `/pricing` | `/metrics?type=entry` | First pages of Reddit-referred visits |
| Bounce rate from Reddit | — | Stats with referrer=reddit.com | `/stats?referrer=reddit.com` | `bounces / visits` |

### 7.1 Deriving "Reddit Signups"

Umami tracks visitors, not signups directly. To measure signups from Reddit:

**Option A (UTM-based):** All Reddit links in comments use `?utm_source=reddit&utm_medium=comment`.
Count custom events `trial-start` or `signup-complete` where the session also has
`utm_source=reddit` in its URL query. Requires custom events to be instrumented in the
Fenrir Ledger frontend (issue #332).

**Option B (Referrer-based):** Count sessions where `referrer_domain = reddit.com` and the
session triggered a `trial-start` event. Query via `/events` paginated log with
`referrer=reddit.com&eventType=2&event=trial-start`.

**Option C (Proxy):** Count all visitors from `reddit.com` referrer and apply an industry
conversion rate (typically 1-3%). This is a directional estimate only.

**Recommendation**: Implement Option A (UTM + custom events). This requires:
1. All Reddit comment links include `?utm_source=reddit&utm_medium=comment&utm_campaign=<subreddit>`.
2. The Fenrir Ledger frontend fires a `trial-start` custom event via Umami's tracker when
   a user begins a trial.

### 7.2 Campaign-Level Breakdowns

When posting in different subreddits, use distinct `utm_campaign` values:

| Subreddit | UTM Campaign |
|---|---|
| r/churning | `reddit-churning` |
| r/CreditCards | `reddit-creditcards` |
| r/CreditCardChurning | `reddit-ccc` |

Query breakdown in n8n via `/metrics?type=query` and parse the campaign param. Store
`channel = 'reddit'` and `source = '?utm_campaign=reddit-churning'` in `marketing_metrics`.

---

## 8. Connectivity Test from cork.lan

Before deploying the workflow, verify that n8n on cork.lan can reach the Umami instance:

```bash
# From cork.lan shell or n8n Execute Command node:
curl -s -o /dev/null -w "%{http_code}" \
  https://analytics.fenrirledger.com/api/config
# Expected: 200

# Test authentication:
curl -s -X POST https://analytics.fenrirledger.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<password>"}' \
  | jq .token
# Expected: JWT string

# Test stats endpoint with the returned token:
TOKEN="<jwt-from-above>"
curl -s \
  -H "Authorization: Bearer $TOKEN" \
  "https://analytics.fenrirledger.com/api/websites/ce25059e-57c4-44f9-ad92-389d2bd15e4d/stats?startAt=1741737600000&endAt=1741823999000" \
  | jq .
# Expected: {"pageviews": N, "visitors": N, ...}
```

If the connectivity test fails, check:
- DNS resolution from cork.lan to `analytics.fenrirledger.com`
- TLS certificate validity (check with `curl -v`)
- GKE Ingress firewall rules (GKE → external inbound is default-allow; cork.lan → GKE requires
  that the Ingress public IP is reachable from the cork.lan network)

---

## 9. Downstream Workflow Integration

The `marketing_metrics` table is the single source of truth for all marketing loop
workflows on cork.lan. Downstream workflows query it via PostgreSQL SELECT:

| Downstream | Query pattern |
|---|---|
| Weekly report email | `SELECT * FROM marketing_metrics WHERE period_start >= (NOW() - INTERVAL '7 days')` |
| Content scoring (#1182) | `SELECT value FROM marketing_metrics WHERE metric_type='referrer' AND source='reddit.com' AND period_start = <date>` |
| Closed-loop feedback (#1183) | `SELECT * FROM marketing_metrics WHERE channel='reddit' ORDER BY captured_at DESC` |
| Reddit UTM click funnel | `SELECT source, sum(value) FROM marketing_metrics WHERE metric_type='utm_query' GROUP BY source ORDER BY sum DESC` |

---

## 10. Implementation Checklist (for Odin / cork.lan setup)

- [ ] **Create Umami admin account** dedicated to n8n API access (avoid using the primary admin)
- [ ] **Obtain JWT token** via `/api/auth/login` with the n8n account credentials
- [ ] **Add n8n credential** "Umami Analytics" (Header Auth: `Authorization: Bearer <token>`)
- [ ] **Create PostgreSQL database** `marketing` on cork.lan (or use existing n8n DB)
- [ ] **Run DDL** to create `marketing_metrics` table (section 4 above)
- [ ] **Add n8n PostgreSQL credential** pointing to cork.lan postgres
- [ ] **Import n8n workflow** (build manually per section 5 or export from a reference n8n instance)
- [ ] **Run connectivity tests** from section 8
- [ ] **Activate workflow** — set schedule to `0 6 * * *`
- [ ] **Verify first run** — check `SELECT COUNT(*) FROM marketing_metrics` after 06:00 UTC
- [ ] **Instrument UTM links** on all Reddit comment links (`utm_source=reddit`, `utm_campaign=<subreddit>`)
- [ ] **Instrument custom events** in Fenrir Ledger frontend for `trial-start`, `signup-click` (issue #332)

---

## 11. Known Limitations and Edge Cases

1. **UTM attribution gap**: Umami stores UTM params as raw query strings, not parsed columns.
   The n8n Transform step must parse `?utm_source=...&utm_campaign=...` strings. The
   `URLSearchParams` parser handles this; edge cases include malformed or double-encoded URLs.

2. **Token expiry**: If the Umami JWT expires between n8n runs, the API calls will return 401.
   The n8n workflow should check the HTTP status code and alert (email/Slack) on 401 so the
   token can be refreshed. A sub-workflow for token refresh is recommended for production.

3. **Self-hosted API key unavailable**: The issue notes `x-umami-api-key` as an auth option.
   This header is **Cloud-only** and will not work on `analytics.fenrirledger.com`. Use bearer
   token exclusively.

4. **Backfill**: If the workflow is inactive for several days, re-run with adjusted `startAt`/
   `endAt` to backfill missing dates. The `ON CONFLICT DO UPDATE` upsert handles re-runs safely.

5. **Unique constraint on `time_bucket`**: For `metric_type='stats'` rows (which have no
   time bucket), `time_bucket` is NULL. PostgreSQL NULL is not equal to NULL in unique
   constraints, so multiple `stats` rows for the same `period_start/end` may accumulate.
   Workaround: coerce `time_bucket` to `'1970-01-01'::timestamptz` for non-time-series rows,
   or use a partial index.

6. **Umami v2 report endpoints** (e.g., `/api/reports/utm`): These are Umami v2.10+ features
   and require a Umami "report" object to be pre-created in the UI. They are not directly
   queryable without a `reportId`. Use `/metrics?type=query` for UTM data instead.

---

*Research author: FiremanDecko (Principal Engineer) | Ref: Issue #1180*
*Blocks: Issue #1182 (feedback workflow), Issue #1183 (architecture doc)*
