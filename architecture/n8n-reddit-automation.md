# n8n Reddit Automation Workflows — Technical Research

**Status**: Research | **Owner**: FiremanDecko | **Ref**: Issue #415
**Last updated**: 2026-03-09

> **Critical constraint**: Reddit banned u/Wide-Pass369 on r/CreditCards for AI-generated
> content. All posting MUST be done by a real human through a real browser. n8n's role is
> monitoring, alerting, drafting, and queuing — **never posting**. The automation pipeline
> ends at "draft ready for human review."

**Related documents** (build on, don't duplicate):
- Reddit strategy and engagement playbook: `product/target-market/README.md`
- Historical backlog items now tracked as GitHub Issues

---

## A. n8n Reddit Monitoring Workflows

### A.1 Data Ingestion Approaches

Three viable methods for monitoring r/churning, r/CreditCards (new account required), and
r/CreditCardChurning, listed by risk profile:

| Method | How | Rate Limits | Auth Required | Ban Risk | Recommendation |
|--------|-----|-------------|---------------|----------|----------------|
| **RSS Feeds** | `reddit.com/r/{sub}/new/.rss` via n8n RSS Read node | Undocumented, generous | None | Negligible | **Phase 1 — start here** |
| **JSON API (unauthenticated)** | `reddit.com/r/{sub}/new.json` via HTTP Request node | Strict, may be blocked | None | Low | Fallback if RSS lacks data |
| **Reddit OAuth2 API** | n8n Reddit node with OAuth2 credentials | 100 QPM per client ID | OAuth2 app | Low (read-only) | **Phase 2 — more data** |

**Recommendation**: Start with RSS feeds. They require no authentication, carry near-zero
ban risk, and provide sufficient data (title, author, body preview, timestamp, URL) for
thread scoring. Graduate to OAuth2 API when richer data is needed (comment trees, vote
counts, user flair).

### A.2 RSS Feed Configuration

n8n's `RSS Read` node polls RSS endpoints on a configurable schedule.

**Feed URLs to monitor:**

```
# New posts
https://www.reddit.com/r/churning/new/.rss?limit=25
https://www.reddit.com/r/CreditCards/new/.rss?limit=25    # new account needed
https://www.reddit.com/r/CreditCardChurning/new/.rss?limit=25

# Keyword search feeds (high-signal)
https://www.reddit.com/r/churning/search.rss?q=tracker+OR+spreadsheet+OR+"annual+fee"+OR+"5/24"&sort=new&restrict_sr=on&limit=10
https://www.reddit.com/r/CreditCards/search.rss?q="card+tracker"+OR+"bonus+tracking"+OR+"how+do+you+track"&sort=new&restrict_sr=on&limit=10
https://www.reddit.com/r/CreditCardChurning/search.rss?q=tracker+OR+app+OR+tool+OR+spreadsheet&sort=new&restrict_sr=on&limit=10
```

**Polling interval**: Every 15 minutes during 8am-10pm ET (peak Reddit activity).
Reduce to every 60 minutes overnight. n8n's Cron trigger node handles this schedule.

### A.3 OAuth2 API Setup (Phase 2)

For richer thread data when RSS is insufficient:

1. Create a Reddit "script" app at `https://www.reddit.com/prefs/apps/`
2. Use a dedicated monitoring account (NOT the engagement account)
3. Configure n8n Reddit OAuth2 credentials with client ID and secret
4. Set a descriptive `User-Agent` header: `n8n-fenrir-monitor/1.0 (by u/<monitor-account>)`

**Endpoints for monitoring:**
- `GET /r/{subreddit}/new` — new posts with full metadata
- `GET /r/{subreddit}/comments` — recent comments across the subreddit
- `GET /r/{subreddit}/search` — keyword search with sorting

**Rate limit budget**: 100 queries/min. With 3 subreddits polled every 5 minutes
(3 new-post calls + 3 comment calls + 3 search calls = 9 calls/5min = ~2 QPM), well
within limits. Leaves headroom for on-demand queries.

### A.4 Thread Scoring and Filtering

Not every thread is worth engaging with. The scoring function filters out noise before
alerting Freya. Implemented as an n8n Function node after the RSS/API read.

**Scoring criteria** (adapted from `marketing-campaign-plan.md` §6.2):

| Signal | Points | Rationale |
|--------|--------|-----------|
| Title contains target keyword (tracker, spreadsheet, annual fee, 5/24, bonus tracking, velocity, "how do you track") | +3 | Direct relevance to Fenrir's value proposition |
| Post is in a recurring high-value thread (Daily Question, WCYG, Data Points Central) | +2 | Best engagement opportunity per subreddit-profiles.md §1.4 |
| Post age < 4 hours | +2 | Fresh threads = higher visibility |
| Post age 4-24 hours | +1 | Still viable |
| Post age > 48 hours | -5 | Skip per campaign plan §6.4 |
| Post has 5-50 comments | +1 | Active but not buried |
| Post has > 100 comments | -1 | New comments likely buried |
| Post is in r/CreditCardChurning | +1 | More receptive to tool discussion |
| Title matches skip criteria (referral, manufactured spending, CFPB, fraud) | -10 | Hard skip per campaign plan §6.4 |

**Threshold**: Score >= 4 triggers an alert. Score >= 6 is high-priority.

**Implementation** (n8n Function node):

```javascript
// Thread scoring function for n8n
const KEYWORDS = [
  'tracker', 'spreadsheet', 'annual fee', '5/24', 'bonus track',
  'velocity', 'how do you track', 'what do you use', 'card tracker',
  'signup bonus', 'sign-up bonus', 'fee reminder'
];
const SKIP_KEYWORDS = [
  'referral', 'manufactured spending', 'CFPB', 'fraud',
  'chargeback', 'dispute', 'balance transfer'
];
const HIGH_VALUE_THREADS = [
  'daily question', 'daily discussion', 'what card should',
  'data points', 'frustration friday'
];

for (const item of $input.all()) {
  const title = (item.json.title || '').toLowerCase();
  const ageHours = (Date.now() - new Date(item.json.pubDate).getTime()) / 3600000;
  const commentCount = item.json.num_comments || 0;
  let score = 0;

  // Keyword match
  if (KEYWORDS.some(kw => title.includes(kw))) score += 3;

  // High-value thread
  if (HIGH_VALUE_THREADS.some(t => title.includes(t))) score += 2;

  // Age scoring
  if (ageHours < 4) score += 2;
  else if (ageHours <= 24) score += 1;
  else if (ageHours > 48) score -= 5;

  // Comment count
  if (commentCount >= 5 && commentCount <= 50) score += 1;
  if (commentCount > 100) score -= 1;

  // Subreddit bonus
  if ((item.json.link || '').includes('CreditCardChurning')) score += 1;

  // Skip filter
  if (SKIP_KEYWORDS.some(kw => title.includes(kw))) score -= 10;

  item.json.opportunityScore = score;
  item.json.priority = score >= 6 ? 'high' : score >= 4 ? 'normal' : 'skip';
  item.json.ageHours = Math.round(ageHours);
}

return $input.all().filter(item => item.json.priority !== 'skip');
```

### A.5 Deduplication

Track previously seen thread IDs to avoid re-alerting. Use n8n's workflow static data
(`$getWorkflowStaticData('global')`) for a lightweight seen-set, or PostgreSQL for
persistence across container restarts.

```javascript
const staticData = $getWorkflowStaticData('global');
if (!staticData.seenIds) staticData.seenIds = [];

const newItems = $input.all().filter(item => {
  const id = item.json.id || item.json.guid;
  if (staticData.seenIds.includes(id)) return false;
  staticData.seenIds.push(id);
  return true;
});

// Trim to last 500 IDs to prevent unbounded growth
if (staticData.seenIds.length > 500) {
  staticData.seenIds = staticData.seenIds.slice(-500);
}

return newItems;
```

---

## B. Comment Drafting Pipeline

### B.1 Ollama Integration on cork.lan

n8n has built-in Ollama integration via the `Ollama Chat Model` node. Since both n8n
and Ollama run on cork.lan, they communicate over the local network with zero external
API costs.

**Connection configuration:**

| Setting | Value |
|---------|-------|
| Base URL | `http://cork.lan:11434` (or `http://localhost:11434` if same host) |
| Docker-to-Docker | `http://ollama:11434` (on shared Docker network) |
| API Endpoint | `/api/chat` (conversational, preferred) |
| Timeout | 120 seconds (large models may need this) |

**n8n integration options:**
1. **Ollama Chat Model node** (built-in) — native LangChain integration, simplest setup
2. **HTTP Request node** to `/api/chat` — more control over parameters, recommended for
   production tuning of temperature, top_p, repeat_penalty

### B.2 Recommended Ollama Models

Based on research into natural conversational writing quality, anti-detection capability,
and resource requirements on a typical LAN server:

| Model | Size | VRAM (Q5_K_M) | Strengths | Best For |
|-------|------|---------------|-----------|----------|
| **Qwen 2.5 7B** | 7B | ~7-8 GB | Excellent storytelling, natural flow, varied sentence structures | Primary drafting model |
| **Llama 3.1 8B** | 8B | ~7-8 GB | Strong instruction following, 128K context, solid reasoning | Complex thread analysis + drafting |
| **Vicuna 13B** | 13B | ~12-14 GB | Trained on real conversations (ShareGPT), most naturally human | Highest-stakes drafts requiring maximum naturalness |
| **Mistral 7B** | 7B | ~7-8 GB | Fast generation, good quality, low latency | High-volume drafting when speed matters |

**Primary recommendation**: **Qwen 2.5 7B** (Q5_K_M quantization). It balances quality,
speed (~40-50 tok/s on an 8GB GPU), and natural-sounding output. Fall back to Vicuna 13B
for high-priority threads where anti-detection is especially critical.

**Models to avoid for this use case:**
- DeepSeek-R1 — too reasoning-focused, produces stiff/formal output
- Phi-3/Phi-4 — limited conversational quality
- Any 70B+ model — overkill for comment drafting, resource-intensive

### B.3 Prompt Engineering for Anti-Detection

The system prompt is critical. It must produce output that reads like a knowledgeable
churner, not an AI assistant. The prompt references jargon and tone guidance from
`subreddit-profiles.md` §1.3 and `reddit-content-templates.md`.

**System prompt template:**

```
You are drafting a Reddit comment for a knowledgeable credit card churner to post
on r/{subreddit}. The comment is a DRAFT — a human will review and edit it before
posting. Write as if you ARE a churner sharing personal experience.

RULES:
- First person only ("I track mine by...", "what worked for me...")
- Use r/{subreddit} jargon naturally: {jargon_list}
- Vary sentence length dramatically. Mix short punchy sentences with longer ones.
- Include 1-2 specific personal details (card names, dates, dollar amounts)
- Express uncertainty sometimes ("not 100% sure on this", "YMMV", "tbh")
- Use natural transitions ("that said", "the catch is", "honestly")
- No filler words: NEVER use "delve", "utilize", "moreover", "furthermore",
  "additionally", "crucial", "pivotal", "tapestry", "boasts"
- No lists or bullet points unless the question specifically asks for a breakdown
- Stay under 200 words (Reddit comments that are too long get skipped)
- Match the tone and depth to the thread context below

THREAD CONTEXT:
Title: {thread_title}
Subreddit: r/{subreddit}
Body: {thread_body}
Top comments: {top_comments_summary}

Draft a single comment responding to this thread.
```

**Jargon lists by subreddit** (pulled from `subreddit-profiles.md` §1.3):
- **r/churning**: DP, SUB, MSR, AF, 5/24, 2/30, PC, RECON, P2, AOR, NLL, CPP, YMMV
- **r/CreditCardChurning**: Same as r/churning
- **r/CreditCards**: Spell out terms — "sign-up bonus", "annual fee", "data point"

### B.4 Generation Parameters

For natural-sounding output, use non-default generation parameters:

```json
{
  "model": "qwen2.5:7b-instruct-q5_K_M",
  "messages": [ ... ],
  "stream": false,
  "options": {
    "temperature": 0.95,
    "top_p": 0.92,
    "top_k": 50,
    "repeat_penalty": 1.12,
    "num_predict": 300,
    "num_ctx": 8192
  }
}
```

| Parameter | Value | Why |
|-----------|-------|-----|
| temperature | 0.95 | Higher than default (0.8) for more varied, less predictable text |
| top_p | 0.92 | Broad vocabulary selection, avoids repetitive word choices |
| top_k | 50 | Prevents overly rare token selection |
| repeat_penalty | 1.12 | Actively penalizes repeated phrases — critical for anti-detection |
| num_predict | 300 | Cap output length; Reddit comments should be concise |
| num_ctx | 8192 | Enough context for thread + system prompt |

### B.5 Draft Quality Gate

Before surfacing a draft to the human reviewer, run an automated quality check
(n8n Function node):

```javascript
const draft = $input.first().json.draft;
const BANNED_WORDS = [
  'delve', 'utilize', 'moreover', 'furthermore', 'additionally',
  'crucial', 'pivotal', 'tapestry', 'boasts', 'bolstered',
  'I recently had the pleasure', 'in conclusion', 'it is worth noting'
];
const flags = [];

// Check for AI-telltale words
for (const word of BANNED_WORDS) {
  if (draft.toLowerCase().includes(word)) {
    flags.push(`Contains banned word: "${word}"`);
  }
}

// Check length (too long = suspicious)
const wordCount = draft.split(/\s+/).length;
if (wordCount > 250) flags.push(`Too long: ${wordCount} words`);
if (wordCount < 15) flags.push(`Too short: ${wordCount} words`);

// Check for list/bullet patterns (unnatural for casual comments)
if (/^[\s]*[-*\d]+[.)]/m.test(draft)) {
  flags.push('Contains list formatting — may look AI-generated');
}

// Check sentence variety (flag if all sentences are similar length)
const sentences = draft.split(/[.!?]+/).filter(s => s.trim().length > 0);
const lengths = sentences.map(s => s.trim().split(/\s+/).length);
const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
const variance = lengths.reduce((sum, l) => sum + Math.pow(l - avgLen, 2), 0) / lengths.length;
if (variance < 4) flags.push('Low sentence length variance — may sound monotone');

$input.first().json.qualityFlags = flags;
$input.first().json.passedQualityGate = flags.length === 0;

return $input.all();
```

Drafts that fail the quality gate are regenerated (up to 2 retries with increased
temperature) before being queued with flags for human awareness.

### B.6 Draft Queue and Storage

Approved drafts are stored in a PostgreSQL table on cork.lan for the human reviewer
to access. Schema:

```sql
CREATE TABLE reddit_drafts (
  id            SERIAL PRIMARY KEY,
  created_at    TIMESTAMP DEFAULT NOW(),
  subreddit     VARCHAR(50) NOT NULL,
  thread_url    TEXT NOT NULL,
  thread_title  TEXT NOT NULL,
  thread_score  INT,
  draft_text    TEXT NOT NULL,
  model_used    VARCHAR(50),
  quality_flags TEXT[],
  status        VARCHAR(20) DEFAULT 'pending',  -- pending | approved | rejected | posted
  reviewed_at   TIMESTAMP,
  reviewer_note TEXT,
  posted_at     TIMESTAMP
);
```

**Status flow**: `pending` -> human reviews -> `approved` (or `rejected`) -> human posts
via browser -> marked `posted` with timestamp.

---

## C. Human Review Interface

### C.1 Review Options Evaluated

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **n8n UI** | Already deployed, no extra infra | Not designed for content review, clunky for this | Not recommended |
| **Email-based review** | Zero new infra, works on phone, Freya already has Gmail | Limited editing, no queue management | **Phase 1 — start here** |
| **Simple web dashboard** | Purpose-built, best UX for reviewing/editing | Requires building and hosting | Phase 2 |
| **Slack/Discord bot** | Familiar interface, quick approve/reject | Requires Slack/Discord account, editing is awkward | Alternative to email |

### C.2 Email-Based Review Workflow (Phase 1)

When a draft passes the quality gate, n8n sends an email to Freya's Gmail:

**Email template:**

```
Subject: [Reddit Draft] r/{subreddit} — {thread_title}

THREAD:
{thread_url}
Score: {opportunity_score} | Age: {age_hours}h | Comments: {comment_count}

DRAFT:
---
{draft_text}
---

Quality flags: {flags_or_none}
Model: {model_used}

ACTION:
- Open the thread link above
- Read the context
- Copy the draft, edit as needed
- Post via browser when ready
- Reply to this email with "posted" or "skip" (for tracking)
```

**n8n implementation**: Use the `Send Email` node with Gmail SMTP:
- Host: `smtp.gmail.com`
- Port: 465 (SSL)
- Auth: Gmail app password (stored in n8n credentials, never in code)

**Tracking replies**: n8n's Gmail node can poll for replies to draft emails. A reply
containing "posted" updates the draft status in PostgreSQL. A reply with "skip" marks
it `rejected`.

### C.3 Full Review Workflow

```
Opportunity detected
     |
     v
Ollama drafts comment
     |
     v
Quality gate check ── FAIL ──> Regenerate (up to 2x)
     |                                   |
     PASS                           Still fails
     |                                   |
     v                                   v
Email to Freya                   Queue with flags
     |
     v
Freya reads thread in browser
     |
     v
Freya edits draft (or writes from scratch)
     |
     v
Freya posts via browser manually
     |
     v
Freya replies "posted" to email
     |
     v
n8n updates draft status + logs engagement
```

The human is ALWAYS the one clicking "submit" on Reddit. n8n never touches Reddit's
write endpoints.

---

## D. Anti-Detection Strategy

### D.1 Lessons from the r/CreditCards Ban

u/Wide-Pass369 was banned from r/CreditCards for AI-generated content. This means:

1. **Reddit moderators (and possibly AutoMod) actively detect AI patterns** — formulaic
   language, uniform sentence structure, and lack of personal specificity are flags.
2. **A new account is needed for r/CreditCards** — the ban is likely permanent for that
   username. The new account must have zero connection to the banned one (different email,
   different IP/VPN during creation if possible).
3. **The bar for naturalness is now higher** — any future detection means a second ban
   and potential sub-wide scrutiny of Fenrir-associated accounts.

### D.2 AI Detection Signals to Avoid

These are the most commonly flagged patterns, based on both Reddit community reports
and AI detection research:

| Signal | Why It's Flagged | Mitigation |
|--------|------------------|------------|
| Uniform sentence length | Humans vary dramatically; AI defaults to consistent patterns | Prompt for "high burstiness"; quality gate checks variance |
| Formulaic transitions ("Furthermore", "Moreover", "Additionally") | Classic GPT/Claude tell | Banned word list in quality gate; prompt instructs natural transitions |
| Symmetric structure (intro → 3 points → conclusion) | Real Reddit comments don't follow essay structure | Prompt says "no lists unless asked"; quality gate flags bullet patterns |
| Lack of personal specificity | AI gives generic advice; humans reference their cards, dates, outcomes | Prompt requires 1-2 specific details; human reviewer adds real ones |
| Overly helpful/polished tone | Real Reddit users are sometimes terse, opinionated, incomplete | Prompt allows for brevity, uncertainty, casual language |
| Perfect grammar and spelling | Real users make typos, use sentence fragments | Human reviewer may intentionally leave minor imperfections |
| Hedging with "I'd recommend" / "It's important to note" | Corporate-speak | Banned phrase list; prompt instructs first-person experience |

### D.3 Natural Engagement Patterns

Beyond the comment text itself, the posting PATTERN matters:

| Pattern | Natural | Suspicious |
|---------|---------|------------|
| **Timing** | Varied — sometimes morning, sometimes evening, occasional gaps of 2-3 days | Same time every day, exactly N comments per day |
| **Response delay** | 5-45 min after seeing a thread (a person reads, thinks, types) | Instant response to new threads |
| **Thread selection** | Skips some obvious opportunities (humans don't engage with everything) | Engages with every matching thread |
| **Comment length** | Varies — some 2-sentence replies, some 150-word answers | Always approximately the same length |
| **Follow-up** | Sometimes replies to replies, sometimes doesn't | Never follows up or always follows up |
| **Weekend activity** | May skip weekends or post casually | Perfectly consistent 7 days/week |

**Implementation**: n8n should NOT send alerts at perfectly regular intervals. Add
randomized delays (n8n's `Wait` node with a random duration between 0 and 30 minutes)
before emailing drafts. This prevents Freya from developing a robotic posting cadence.

### D.4 Quality Gates Before Human Review

Drafts pass through three automated gates before reaching Freya:

1. **Banned-word filter** (§B.5) — rejects drafts with known AI-telltale language
2. **Sentence variance check** (§B.5) — flags drafts with monotone sentence structure
3. **Length check** — rejects comments > 250 words or < 15 words
4. **Duplicate check** — compares against the last 50 posted drafts for similarity
   (reject if cosine similarity > 0.7 — implementable via Ollama embeddings endpoint)

Failed drafts are either regenerated (temperature += 0.1, max 2 retries) or silently
dropped with a log entry explaining why.

---

## E. Infrastructure

### E.1 Docker Containers on cork.lan

```
+--------------------+     +--------------------+     +--------------------+
|     n8n            |     |     Ollama          |     |   PostgreSQL       |
|  Port: 5678        |<--->|  Port: 11434        |     |  Port: 5432        |
|  Workflows, cron,  |     |  Qwen 2.5 7B        |     |  Draft queue,      |
|  email, HTTP       |     |  (+ Vicuna 13B)     |     |  engagement log,   |
|                    |<--->|                      |     |  opportunity log   |
+--------------------+     +--------------------+     +--------------------+
         |                                                      ^
         |                                                      |
         +------------------------------------------------------+
         |
         v
+--------------------+
|  Gmail (SMTP)      |
|  Draft notifications|
|  to Freya          |
+--------------------+
```

### E.2 Docker Compose

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    ports:
      - "5678:5678"
    environment:
      - N8N_HOST=cork.lan
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_PORT=5432
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=${N8N_DB_PASSWORD}
      - N8N_ENCRYPTION_KEY=${N8N_ENCRYPTION_KEY}
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres
    networks:
      - fenrir-net
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    networks:
      - fenrir-net
    restart: unless-stopped
    # Add GPU passthrough if available:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - capabilities: [gpu]

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=n8n
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=${N8N_DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - fenrir-net
    restart: unless-stopped

volumes:
  n8n_data:
  ollama_data:
  postgres_data:

networks:
  fenrir-net:
    driver: bridge
```

### E.3 Ollama Model Setup

After deploying the Ollama container:

```bash
# Pull primary model
docker exec ollama ollama pull qwen2.5:7b-instruct-q5_K_M

# Pull backup model for high-priority drafts
docker exec ollama ollama pull vicuna:13b-v1.5-q5_K_M

# Verify models loaded
docker exec ollama ollama list
```

**Resource requirements for cork.lan:**

| Model | VRAM | System RAM | Disk |
|-------|------|------------|------|
| Qwen 2.5 7B (Q5_K_M) | ~7 GB | 16 GB min | ~5 GB |
| Vicuna 13B (Q5_K_M) | ~12 GB | 16 GB min | ~9 GB |
| Both loaded concurrently | ~19 GB | 32 GB | ~14 GB |

If cork.lan lacks a GPU, CPU-only inference works but is 15-20x slower (~2-3 tok/s
for 7B models). This is still acceptable since drafts are not time-critical — a
60-second wait per draft is fine when a human reviews hours later.

### E.4 Data Storage

| Data | Location | Retention |
|------|----------|-----------|
| n8n workflows & credentials | `n8n_data` Docker volume | Permanent |
| Draft queue, engagement log | PostgreSQL `n8n` database | 12 months rolling |
| Ollama models | `ollama_data` Docker volume | Permanent |
| Thread opportunity log | PostgreSQL | 6 months rolling |
| Email notification history | Gmail (Freya's account) | Gmail retention |

**Backup**: Weekly `pg_dump` of the PostgreSQL database to a local backup directory.
Include `n8n_data` volume in cork.lan's existing backup routine.

---

## F. Proposed Workflows

### F.1 Workflow 1: Subreddit Monitor -> Thread Scorer -> Alert

**Purpose**: Continuously monitor target subreddits, score threads for relevance, and
alert Freya when engagement opportunities arise.

**Trigger**: Cron — every 15 minutes, 8am-10pm ET weekdays; every 60 minutes weekends.

```
[Cron Trigger]
     |
     v
[RSS Read: r/churning/new]  [RSS Read: r/CreditCards/new]  [RSS Read: r/CreditCardChurning/new]
     |                               |                               |
     +-------------------------------+-------------------------------+
     |
     v
[Merge Node: combine all feeds]
     |
     v
[Function: Deduplicate (check static data for seen IDs)]
     |
     v
[Function: Thread Scorer (§A.4 scoring logic)]
     |
     v
[IF: score >= 4]
     |           \
     |            NO -> [No Op: skip]
     YES
     |
     v
[PostgreSQL: Insert into opportunity_log table]
     |
     v
[IF: score >= 6 (high priority)]
     |           \
     |            NO -> [Wait: random 0-15 min] -> normal priority email
     YES
     |
     v
[Send Email: high-priority alert to Freya with thread details]
```

**Email subject line format**: `[HI] r/churning — "How do you track your annual fees?"`
(or `[LO]` for normal priority).

### F.2 Workflow 2: Opportunity -> Ollama Draft -> Review Queue -> Email

**Purpose**: When a high-score opportunity is detected, generate a draft comment using
Ollama and email it to Freya for review.

**Trigger**: Webhook (called by Workflow 1 for score >= 6 threads) or manual trigger.

```
[Webhook: receives thread data from Workflow 1]
     |
     v
[HTTP Request: fetch thread body + top 5 comments via Reddit JSON API]
     |
     v
[Function: Build Ollama prompt]
  - System prompt from §B.3 template
  - Inject subreddit-specific jargon list
  - Include thread title, body, top comments as context
     |
     v
[HTTP Request: POST to Ollama /api/chat]
  - Model: qwen2.5:7b-instruct-q5_K_M
  - Parameters from §B.4
     |
     v
[Function: Quality Gate (§B.5)]
     |
     PASS                           FAIL
     |                                |
     v                                v
[PostgreSQL: Insert draft]     [IF: retry count < 2]
  status = 'pending'                  |         \
     |                                YES        NO
     v                                |           |
[Wait: random 5-30 min]         [Increase temp]  [Log: "quality gate failed after retries"]
     |                                |
     v                                v
[Send Email: draft to Freya]   [Back to Ollama request]
```

**Key design decisions:**
- Random wait before emailing prevents predictable cadence
- Quality gate catches AI-telltale language before Freya sees it
- Retry with higher temperature produces more varied output on failure
- PostgreSQL stores all drafts (approved, rejected, failed) for analysis

### F.3 Workflow 3: Engagement Tracker

**Purpose**: Monitor previously posted comments for upvotes and replies. Feed data back
to the scoring model and weekly metrics report.

**Trigger**: Cron — daily at 10pm ET.

```
[Cron Trigger: daily 10pm ET]
     |
     v
[PostgreSQL: SELECT * FROM reddit_drafts WHERE status = 'posted']
     |
     v
[Loop: for each posted comment]
     |
     v
[HTTP Request: GET comment data via Reddit JSON API]
  - Endpoint: {comment_permalink}.json
  - Extract: score, num_replies, is_removed
     |
     v
[PostgreSQL: UPDATE engagement metrics]
  - upvotes, reply_count, last_checked
     |
     v
[IF: any comment has score < -2]
     |           \
     |            NO -> continue loop
     YES
     |
     v
[Send Email: Alert — "Comment receiving downvotes, review needed"]
     |
     v
[End Loop]
     |
     v
[Function: Calculate weekly metrics]
  - Total comments posted this week
  - Average upvotes
  - Positive reply ratio
  - Compare to targets in reddit-success-metrics.md §2.1
     |
     v
[IF: today is Friday]
     |           \
     |            NO -> end
     YES
     |
     v
[Send Email: Weekly Reddit metrics summary to Freya + Odin]
```

**Metrics email template:**

```
Subject: Reddit Weekly Report — Week of {date}

Comments posted: {count}
Average upvotes: {avg}
Positive reply ratio: {ratio}%
Current karma (est): {karma_delta}
High-value comments (10+): {hv_count}

Top performing comment:
  r/{sub} — "{thread_title}" — {upvotes} upvotes
  {comment_url}

Flags:
  {any_downvoted_comments_or_concerns}
```

---

## G. Implementation Plan

### Phase 1: Monitoring Only (Estimated effort: 1-2 days)

**Goal**: Get subreddit monitoring and alerting working. No drafting, no Ollama.

**Tasks:**
1. Deploy n8n + PostgreSQL containers on cork.lan (Docker Compose from §E.2)
2. Configure Gmail SMTP credentials in n8n
3. Build Workflow 1 (§F.1): RSS feeds -> thread scorer -> email alerts
4. Create `opportunity_log` table in PostgreSQL
5. Test with 24 hours of live monitoring
6. Tune scoring thresholds based on alert volume (target: 3-8 alerts/day)

**Dependencies**: Docker installed on cork.lan, Gmail app password created.

**Definition of done**: Freya receives email alerts for relevant threads within 15
minutes of posting, with < 20% false positive rate.

### Phase 2: Add Ollama Drafting (Estimated effort: 2-3 days)

**Goal**: Automatically generate draft comments for high-score opportunities.

**Tasks:**
1. Deploy Ollama container, pull Qwen 2.5 7B model
2. Test Ollama API connectivity from n8n
3. Build prompt templates referencing subreddit-profiles.md jargon lists
4. Implement quality gate function (§B.5)
5. Build Workflow 2 (§F.2): opportunity -> draft -> quality gate -> email
6. Create `reddit_drafts` table in PostgreSQL
7. Test draft quality with 20 sample threads
8. Tune temperature and system prompt based on output quality
9. Set up email-based status tracking (reply "posted" or "skip")

**Dependencies**: Phase 1 complete, Ollama running on cork.lan (GPU optional but
recommended).

**Definition of done**: Drafts pass quality gate > 80% of the time on first attempt.
Freya rates > 60% of drafts as "usable with minor edits."

### Phase 3: Add Engagement Tracking (Estimated effort: 1-2 days)

**Goal**: Track posted comment performance and generate weekly reports.

**Tasks:**
1. Create Reddit OAuth2 "script" app for read-only API access
2. Build Workflow 3 (§F.3): daily engagement check + weekly report
3. Implement downvote alerting (score < -2 triggers email)
4. Build weekly metrics email matching format in reddit-success-metrics.md
5. Test with manually posted comment URLs
6. Connect metrics to phase gate criteria from reddit-success-metrics.md §1

**Dependencies**: Phase 2 complete, at least 5 comments posted manually to track.

**Definition of done**: Weekly metrics email sent automatically every Friday. Downvote
alerts fire within 24 hours. Metrics align with KPI definitions in reddit-success-metrics.md.

### Timeline Summary

| Phase | Effort | Depends On | Delivers |
|-------|--------|------------|----------|
| Phase 1: Monitoring | 1-2 days | Docker on cork.lan, Gmail | Email alerts for relevant threads |
| Phase 2: Drafting | 2-3 days | Phase 1, Ollama on cork.lan | AI-drafted comments in email for review |
| Phase 3: Tracking | 1-2 days | Phase 2, Reddit OAuth2 app | Weekly engagement reports, downvote alerts |

**Total estimated effort**: 4-7 days of engineering time.

---

*Research author: FiremanDecko (Principal Engineer) | Ref: Issue #415*
*Review: Awaiting Odin approval*
