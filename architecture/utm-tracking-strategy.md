# UTM Tracking Strategy — Fenrir Ledger

**Status**: Approved | **Owner**: FiremanDecko | **Ref**: Issue #1181
**Last updated**: 2026-03-17

> Every link to fenrirledger.com from any marketing channel MUST carry UTM parameters
> following this naming convention. Umami captures them automatically. n8n reads them
> via the API to close the feedback loop (issue #1179).

**Related documents:**
- n8n Reddit automation workflows: `architecture/n8n-reddit-automation.md`
- System design: `architecture/system-design.md`
- Umami API connector: issue #1180
- Parent feedback loop investigation: issue #1179
- Original UTM tracking issue (Vercel Analytics era): issue #332

---

## 1. Why UTM Parameters

Umami collects page views automatically. Without UTM parameters, Umami can attribute
traffic to a referring domain (e.g., `reddit.com`) but cannot distinguish:

- Which subreddit the click came from
- Which specific thread or post drove the visit
- Which campaign phase generated the conversion

UTM parameters are query-string tags that Umami reads on page load and records
alongside the page view. No additional code is needed in the app — Umami's script
handles collection. The result is a filterable breakdown in Umami's dashboard and
via the API.

---

## 2. UTM Parameter Taxonomy

Four parameters are used. `utm_term` is reserved for paid search only (not applicable
to Fenrir's current organic/social strategy) and is omitted from this spec.

### 2.1 Parameter Overview

| Parameter | Purpose | Required? | Format |
|-----------|---------|-----------|--------|
| `utm_source` | Which platform sent the visitor | Yes | lowercase, no spaces |
| `utm_medium` | What type of channel | Yes | lowercase, no spaces |
| `utm_campaign` | Which initiative/theme | Yes | lowercase, hyphen-delimited |
| `utm_content` | Which specific piece of content | Yes | lowercase, hyphen-delimited |

All four parameters are required on every external link. Partial tagging creates
attribution gaps that are worse than no tagging (they produce misleading data).

### 2.2 `utm_source` — Platform Name

Identifies the platform where the link was placed.

| Value | Platform |
|-------|----------|
| `reddit` | Any Reddit post or comment |
| `twitter` | Twitter / X posts |
| `blog` | External blog post or guest post |
| `newsletter` | Email newsletter send |
| `producthunt` | Product Hunt listing or comment |
| `hackernews` | Hacker News post or comment |
| `discord` | Discord server post |
| `linkedin` | LinkedIn post or article |
| `youtube` | YouTube video description or comment |
| `direct` | Manually shared link (e.g., DM, personal email) |

Rules:
- Always lowercase.
- Never include a TLD (`reddit`, not `reddit.com`).
- For Reddit specifically, the subreddit is encoded in `utm_campaign` (see §2.4),
  not in `utm_source`.

### 2.3 `utm_medium` — Traffic Type

Describes the broad category of the channel. Maps to how Umami groups traffic.

| Value | When to use |
|-------|-------------|
| `social` | Social media platforms (Reddit, Twitter, LinkedIn, Discord) |
| `organic` | SEO-driven content, unpaid blog posts, HN posts |
| `email` | Newsletter sends, email outreach |
| `referral` | External sites linking to Fenrir without a campaign |
| `cpc` | Paid advertising (future — not in current use) |

Rules:
- Use `social` for community-driven platforms where the link is placed in a comment
  or post (Reddit, HN, Discord, Twitter).
- Use `organic` for content published on Fenrir's own blog or third-party content
  syndication without paid promotion.
- Use `email` for all newsletter campaigns regardless of provider.

### 2.4 `utm_campaign` — Initiative Identifier

Encodes the marketing initiative, channel context, and topic in a single slug.

**Pattern:** `{channel}-{phase-or-season}-{topic}`

| Component | Description | Examples |
|-----------|-------------|---------|
| `channel` | Source platform abbreviation | `reddit`, `blog`, `hn`, `ph` |
| `phase-or-season` | Campaign phase (e.g., `p2` for Phase 2) or date-based season (e.g., `q1-2026`) | `p2`, `q2-2026` |
| `topic` | Short slug describing the theme | `churning`, `af-tracker`, `signup-bonus` |

**Examples:**

| Campaign slug | Meaning |
|---------------|---------|
| `reddit-p2-churning` | Reddit Phase 2 engagement targeting r/churning |
| `reddit-p2-creditcards` | Reddit Phase 2 targeting r/CreditCards |
| `blog-q1-2026-af-guide` | Blog post campaign Q1 2026, annual fee guide topic |
| `hn-launch-v1` | Hacker News Show HN launch post |
| `ph-launch-v1` | Product Hunt launch |
| `newsletter-q1-2026-onboarding` | Q1 2026 onboarding newsletter sequence |

Rules:
- Maximum 50 characters.
- Use hyphens only — no underscores, spaces, or slashes.
- Phase numbers use `p{n}` prefix (e.g., `p2`). Date-based use `q{n}-{yyyy}`.
- Keep topic slugs short (2-4 words max, hyphen-delimited).
- The same campaign value appears on ALL links within that initiative regardless
  of the specific piece of content (that differentiation is `utm_content`).

### 2.5 `utm_content` — Specific Content Piece

Identifies the individual piece of content that contained the link. This is what
enables per-post, per-thread, per-article attribution within a campaign.

**Pattern:** `{content-type-or-slug}` — a slug derived from the specific content.

| Content context | Convention | Examples |
|----------------|-----------|---------|
| Reddit thread | Subreddit abbreviation + thread slug from URL | `churning-dq-20260316`, `creditcards-tracker-rec-abc123` |
| Blog post | Blog post slug | `af-tracker-comparison`, `5-24-rule-explainer` |
| Newsletter | Newsletter issue number or date | `issue-042`, `2026-03-weekly` |
| Product Hunt | Always `main-listing` | `main-listing` |
| HN | Always `show-hn-post` | `show-hn-post` |
| Social card/tweet | Short description of the post | `pricing-launch-tweet`, `feature-demo-video` |

Rules:
- Maximum 60 characters.
- Derived from the URL slug or a short human-readable description.
- For Reddit threads, use `{subreddit_abbrev}-{thread-slug-fragment}` where
  `thread-slug-fragment` comes from the Reddit URL path (first 3-5 words, hyphenated).

---

## 3. Link Construction Examples

### 3.1 Reddit Comment (n8n Workflow 2 output)

Thread: r/churning Daily Discussion 2026-03-16, Fenrir linked in a comment

```
https://fenrirledger.com/features?utm_source=reddit&utm_medium=social&utm_campaign=reddit-p2-churning&utm_content=churning-dq-20260316
```

### 3.2 Reddit Comment on r/CreditCards

```
https://fenrirledger.com/pricing?utm_source=reddit&utm_medium=social&utm_campaign=reddit-p2-creditcards&utm_content=creditcards-what-tracker-use
```

### 3.3 Blog Post — External SEO Article

```
https://fenrirledger.com/?utm_source=blog&utm_medium=organic&utm_campaign=blog-q1-2026-af-guide&utm_content=af-tracker-comparison
```

### 3.4 Product Hunt Launch

```
https://fenrirledger.com/?utm_source=producthunt&utm_medium=social&utm_campaign=ph-launch-v1&utm_content=main-listing
```

### 3.5 Newsletter — Onboarding Sequence

```
https://fenrirledger.com/pricing?utm_source=newsletter&utm_medium=email&utm_campaign=newsletter-q1-2026-onboarding&utm_content=issue-042
```

### 3.6 Hacker News Show HN

```
https://fenrirledger.com/?utm_source=hackernews&utm_medium=social&utm_campaign=hn-launch-v1&utm_content=show-hn-post
```

---

## 4. Reference Table — UTM Combos by Marketing Activity

| Marketing Activity | utm_source | utm_medium | utm_campaign | utm_content |
|-------------------|-----------|-----------|-------------|------------|
| Reddit r/churning comment | `reddit` | `social` | `reddit-p2-churning` | `churning-{thread-slug}` |
| Reddit r/CreditCards comment | `reddit` | `social` | `reddit-p2-creditcards` | `creditcards-{thread-slug}` |
| Reddit r/CreditCardChurning comment | `reddit` | `social` | `reddit-p2-ccc` | `ccc-{thread-slug}` |
| External blog post | `blog` | `organic` | `blog-{quarter}-{topic}` | `{post-slug}` |
| Weekly newsletter | `newsletter` | `email` | `newsletter-{quarter}-{series}` | `issue-{nnn}` |
| Product Hunt launch | `producthunt` | `social` | `ph-launch-v1` | `main-listing` |
| Hacker News Show HN | `hackernews` | `social` | `hn-launch-v1` | `show-hn-post` |
| Twitter / X post | `twitter` | `social` | `twitter-{quarter}-{topic}` | `{post-description}` |
| LinkedIn article | `linkedin` | `social` | `linkedin-{quarter}-{topic}` | `{post-description}` |
| Discord community | `discord` | `social` | `discord-{server}-{topic}` | `{channel-slug}` |
| YouTube video description | `youtube` | `social` | `youtube-{quarter}-{topic}` | `{video-slug}` |

---

## 5. n8n Workflow 2 Integration Design

Workflow 2 (`architecture/n8n-reddit-automation.md §F.2`) generates Reddit comment
drafts that may include a link to fenrirledger.com. This section defines how UTMs
are auto-appended to those links.

### 5.1 Where UTM Injection Happens

After the Ollama HTTP Request node and before the Quality Gate, insert a
**UTM Injection Function Node**:

```
[HTTP Request: POST to Ollama /api/chat]
     |
     v
[Function: UTM Injection]   ← NEW NODE
     |
     v
[Function: Quality Gate]
```

### 5.2 UTM Injection Function (n8n Code Node)

```javascript
// UTM Injection — auto-tags fenrirledger.com links in Ollama draft output
// Runs after Ollama response, before Quality Gate
// Issue #1181

const DOMAIN = 'fenrirledger.com';
const UTM_SOURCE = 'reddit';
const UTM_MEDIUM = 'social';

for (const item of $input.all()) {
  const thread = item.json.thread || {};
  const subreddit = (thread.subreddit || 'unknown').toLowerCase();
  const threadSlug = slugify(thread.title || 'unknown', 40);
  const campaignPhase = item.json.campaignPhase || 'p2';

  // Map subreddit to campaign suffix
  const campaignMap = {
    'churning': 'churning',
    'creditcards': 'creditcards',
    'creditcardchurning': 'ccc',
  };
  const campaignSuffix = campaignMap[subreddit] || subreddit;
  const campaign = `reddit-${campaignPhase}-${campaignSuffix}`;
  const content = `${campaignSuffix}-${threadSlug}`;

  const utmParams = new URLSearchParams({
    utm_source: UTM_SOURCE,
    utm_medium: UTM_MEDIUM,
    utm_campaign: campaign,
    utm_content: content,
  }).toString();

  // Replace bare or already-parameterized fenrirledger.com links in the draft
  const draft = item.json.draft || '';
  item.json.draft = draft.replace(
    /https?:\/\/(?:www\.)?fenrirledger\.com([^\s"')]*)/g,
    (match, path) => {
      // Strip existing UTMs to avoid doubles
      const url = new URL(match.startsWith('http') ? match : `https://fenrirledger.com${path}`);
      ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(p => url.searchParams.delete(p));
      url.search = (url.search ? url.search + '&' : '?') + utmParams;
      return url.toString().replace('?&', '?');
    }
  );

  item.json.utmParams = { utm_source: UTM_SOURCE, utm_medium: UTM_MEDIUM, utm_campaign: campaign, utm_content: content };
}

return $input.all();

function slugify(str, maxLen) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, maxLen)
    .replace(/-+$/, '');
}
```

### 5.3 Campaign Phase Propagation

The `campaignPhase` value (e.g., `p2`) must be injected into Workflow 1's webhook
payload when it triggers Workflow 2. Add to the Workflow 1 webhook body:

```json
{
  "thread": { ... },
  "campaignPhase": "p2"
}
```

Update this value when the marketing phase changes. It is intentionally external
to the UTM injection node so that a phase change requires a single config update.

### 5.4 Draft Template Guidance

Ollama prompts in §B.3 of `architecture/n8n-reddit-automation.md` should include
a placeholder for the UTM-tagged link rather than a bare domain. The UTM Injection
node handles parameterization, so the prompt can use either form:

- Bare: `https://fenrirledger.com/features` — UTM node will tag it.
- Placeholder: `{fenrir_link}` — substitute after UTM injection using a Set node.

Recommended: bare URL in prompt, UTM injection node handles tagging. This keeps
the Ollama prompt simple and the UTM logic centralized.

---

## 6. Umami UTM Query Endpoints

Umami's API exposes UTM breakdowns through the metrics endpoint.
Base URL pattern: `https://{umami-host}/api/websites/{websiteId}/metrics`

All requests require a Bearer token obtained from:
```
POST /api/auth/login
Body: { "username": "...", "password": "..." }
Response: { "token": "..." }
```

### 6.1 Breakdown by UTM Parameter

Replace `{type}` with the UTM parameter name:

```
GET /api/websites/{websiteId}/metrics
  ?type=utm_source
  &startAt={unix_ms}
  &endAt={unix_ms}
```

Valid `type` values for UTM breakdown:
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`

**Example — top sources for past 7 days:**
```
GET /api/websites/{websiteId}/metrics?type=utm_source&startAt=1742169600000&endAt=1742774400000
```

**Response shape:**
```json
[
  { "x": "reddit", "y": 143 },
  { "x": "newsletter", "y": 41 },
  { "x": "blog", "y": 12 }
]
```

### 6.2 Cross-Dimension Filtering

To get traffic for a specific campaign, use `utm_campaign` type and filter results
client-side, or use Umami's `url` filter to scope to a specific page:

```
GET /api/websites/{websiteId}/metrics
  ?type=utm_campaign
  &startAt={unix_ms}
  &endAt={unix_ms}
  &url=/pricing
```

### 6.3 n8n Workflow 3 Integration (Umami Query)

For the feedback loop (issue #1179, #1180), Workflow 3 or a dedicated Umami
analytics workflow can query UTM data as follows:

```javascript
// n8n HTTP Request node configuration
// Method: GET
// URL: https://{umami-host}/api/websites/{{ $env.UMAMI_WEBSITE_ID }}/metrics
// Query params:
//   type: utm_campaign
//   startAt: {{ DateTime.now().minus({ days: 7 }).toMillis() }}
//   endAt: {{ DateTime.now().toMillis() }}
// Headers:
//   Authorization: Bearer {{ $env.UMAMI_API_TOKEN }}
```

### 6.4 Manual Test Procedure

To verify Umami captures UTM params correctly:

1. Construct a tagged test URL:
   ```
   https://fenrirledger.com/?utm_source=test&utm_medium=social&utm_campaign=test-manual-verify&utm_content=manual-check-20260317
   ```
2. Open the URL in a browser (or use curl with a browser-like User-Agent).
3. Wait 30–60 seconds for Umami to process the event.
4. Query:
   ```
   GET /api/websites/{websiteId}/metrics?type=utm_source&startAt=...&endAt=...
   ```
5. Confirm `{ "x": "test", "y": 1 }` appears in the response.
6. Repeat for `type=utm_campaign` — expect `{ "x": "test-manual-verify", "y": 1 }`.

---

## 7. Governance Rules

### 7.1 Adding New Channels

When adding a new marketing channel:

1. Choose a `utm_source` value from §2.2 or define a new lowercase slug.
2. Map it to the correct `utm_medium` from §2.3.
3. Define the campaign naming pattern for that channel following §2.4.
4. Add an entry to the reference table (§4).
5. Update this document.

### 7.2 Campaign Phase Changes

When the Reddit outreach moves to a new phase (e.g., Phase 3):

1. Update `campaignPhase` in Workflow 1's webhook payload (§5.3).
2. Old campaign slugs (`reddit-p2-*`) continue to be valid in historical data.
3. New links use the updated phase slug (`reddit-p3-*`).

### 7.3 Forbidden Patterns

- **Do not** omit any of the four required parameters. Partial UTMs corrupt the data.
- **Do not** use uppercase in any UTM value. Umami is case-sensitive; `Reddit` and
  `reddit` are recorded as different sources.
- **Do not** include PII in any UTM value (no user IDs, email addresses, names).
- **Do not** use spaces — Umami and most analytics tools encode spaces as `%20` or `+`,
  which fragments the breakdown data. Use hyphens.
- **Do not** reuse a `utm_content` value across different pieces of content within
  the same campaign.

### 7.4 Link Shorteners

If a link shortener is used (e.g., for Twitter character limits), apply UTM parameters
to the destination URL BEFORE shortening — not to the shortener URL. The shortener
should 301-redirect with the UTM parameters intact.

---

## 8. Acceptance Criteria Checklist

| # | Criterion | Status |
|---|-----------|--------|
| 1 | UTM naming convention documented (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`) | Done — §2 |
| 2 | Source values per channel defined | Done — §2.2 |
| 3 | Medium values defined | Done — §2.3 |
| 4 | Campaign naming pattern defined | Done — §2.4 |
| 5 | Content values for granular tracking defined | Done — §2.5 |
| 6 | n8n Workflow 2 (#444) design updated for auto-UTM-append | Done — §5 |
| 7 | Umami API query endpoints documented | Done — §6 |
| 8 | Reference table mapping UTM combos to activities | Done — §4 |
| 9 | Manual test procedure for verifying Umami capture | Done — §6.4 |
