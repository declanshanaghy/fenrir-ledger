# Plan: `reddit-post-composer.json` n8n Workflow

GitHub issue: [#2134](https://github.com/declanshanaghy/fenrir-ledger/issues/2134) — *Build n8n Reddit post composer workflow*

## Context

Fenrir Ledger's Reddit campaign needs a tool that turns the subreddit research in `product/research/reddit/*/` into draft Reddit posts Odin can review and submit manually. This workflow bridges research → Claude → draft.

**Scope of this workflow:**
- Compose *original* posts and comments for a launch set of 5 target subs
- Use concise per-sub `profile-reduced.md` data (embedded in the workflow) as the sole source of tone/jargon/rules
- Output a Gmail draft with the composed post + a one-click Reddit submit link

**Out of scope:**
- RSS fetching or live Reddit data (not in scope; the hot-topics idea is parked)
- Auto-posting (every output is a draft for Odin to approve)
- Reply threads to notifications (that's `gmail-reddit-monitor.json`)
- Subs beyond the launch 5 (expand later once the launch set validates)

### Why no DIRECT level (and why r/ynab is a special case)

The epic originally assumed r/CreditCardChurning would be the DIRECT testbed where Fenrir could be named and linked. That subreddit does not exist (verified 2026-04-08 — see [#2147](https://github.com/declanshanaghy/fenrir-ledger/issues/2147)). The phantom profile directory has been deleted.

Of the 5 launch subs, **r/ynab is the only one where naming "Fenrir Ledger" and linking fenrirledger.com is permitted**, and only when the thread is specifically about sign-up bonus / MSR / AF tracking AND the framing is complementary to YNAB (never competitive). Every other sub is strict INDIRECT — "I built a small tracker" soft mentions only, no name, no link.

We model this with **3 promotion levels**:
- `AVOID` — zero product mention. (Not used by any launch sub but kept for future expansion.)
- `INDIRECT` — may say "I built a small tracker" once per thread; no name, no link, no cold drops.
- `NAMED_COMPLEMENTARY` — may name "Fenrir Ledger" and link fenrirledger.com **only when positioned as complementary to the host tool/ecosystem** (currently only r/ynab, where the positioning is YNAB for budget + Fenrir for SUB/MSR/AF tracking). Must still build context before the mention.

`DIRECT` is not an option anywhere and MUST NOT appear in the workflow.

---

## Launch Set (5 subs)

| Sub | Size | Promotion | Source of truth |
|---|---|---|---|
| r/amex | 527k | INDIRECT | `product/research/reddit/amex/profile-reduced.md` |
| r/awardtravel | 500k | INDIRECT | `product/research/reddit/awardtravel/profile-reduced.md` |
| r/ynab | 300k | NAMED_COMPLEMENTARY | `product/research/reddit/ynab/profile-reduced.md` |
| r/delta | 150k | INDIRECT | `product/research/reddit/delta/profile-reduced.md` |
| r/marriottbonvoy | 90k | INDIRECT | `product/research/reddit/marriottbonvoy/profile-reduced.md` |

Each `profile-reduced.md` file contains: voice, hard rules, jargon list, topic hooks, pitfall, length/style guidance, and skip criteria. The full `profile.md` files remain as the deep-research reference — `profile-reduced.md` is the distilled operational version.

---

## Deliverable

**ONE new file:** `infrastructure/n8n/workflows/reddit-post-composer.json`

No changes to:
- Existing workflows
- Helm values / ConfigMap
- Credentials (reuses `anthropic-fenrir` and `Gmail account` already configured)

---

## Profile Feed Strategy: Inline Embedding

Per Odin's decision, `profile-reduced.md` files are embedded directly into the workflow's Code node as a JS literal. This means:

- **Source of truth for humans:** `product/research/reddit/<sub>/profile-reduced.md`
- **Source of truth for the workflow at runtime:** the inline `SUBREDDIT_PROFILES` JS object in Node 5 of `reddit-post-composer.json`
- **Sync:** manual. When a `profile-reduced.md` changes, the workflow JSON must be updated to match and re-imported.

### Drift detection

Because the data lives in two places, there is a non-trivial drift risk. Mitigation: add a validation script (`scripts/validate-reddit-composer-sync.mjs`) that parses the embedded `SUBREDDIT_PROFILES` from the workflow JSON, reads all 5 `profile-reduced.md` files, and fails CI if any field differs. This script is out of scope for the initial workflow build but listed as a follow-up in the risk section.

For now, drift is caught manually: any PR that touches `profile-reduced.md` must also touch `reddit-post-composer.json`.

---

## Workflow Graph

```
┌─────────────────────────┐    ┌─────────────────────────┐
│ Manual Trigger — Random │    │ Manual Trigger — Chosen │
└────────────┬────────────┘    └────────────┬────────────┘
             ▼                               ▼
┌────────────────────────┐      ┌────────────────────────┐
│ Code: Pick Random      │      │ Code: Use Chosen       │
│ sub + prompt           │      │ sub + prompt           │
└────────────┬───────────┘      └────────────┬───────────┘
             │                               │
             └───────────────┬───────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Code: Profile + Prompt      │
              │ Lookup (SUBREDDIT_PROFILES) │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Claude — Compose Post       │
              │ (lmChatAnthropic)           │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Code: Format Draft Email    │
              │ (parse TITLE/BODY, build    │
              │ submit link, compose HTML)  │
              └──────────────┬──────────────┘
                             ▼
              ┌─────────────────────────────┐
              │ Gmail — Create Draft        │
              └─────────────────────────────┘
```

**8 nodes total.**

---

## Node Specifications

### Node 1 — Manual Trigger — Random

- Type: `n8n-nodes-base.manualTrigger`
- Name: `Trigger — Random`
- Purpose: kick off a random-sub, random-prompt composition run

### Node 2 — Manual Trigger — Chosen

- Type: `n8n-nodes-base.manualTrigger`
- Name: `Trigger — Chosen`
- Purpose: operator edits Node 4's code before running to pick a specific sub + prompt

### Node 3 — Code: Pick Random Sub + Prompt

- Type: `n8n-nodes-base.code`, `typeVersion: 2`
- Language: JavaScript
- Upstream: Node 1 only
- Logic:
  ```js
  // Fixed launch set (hardcoded — not read from PREFERRED_SUBREDDITS env var,
  // because PREFERRED has 17 subs but we only compose for the 5 launch subs).
  const LAUNCH_SUBS = ["amex", "awardtravel", "ynab", "delta", "marriottbonvoy"];

  // Defensive check against IGNORED_SUBREDDITS env var (in case any launch sub
  // ends up banned or excluded later — the workflow must refuse to compose for it).
  const ignoredRaw = $env.IGNORED_SUBREDDITS || "";
  const ignored = new Set(
    ignoredRaw.split(",").map(s => s.trim().replace(/^r\//i, "").toLowerCase()).filter(Boolean)
  );

  const candidates = LAUNCH_SUBS.filter(s => !ignored.has(s));
  if (candidates.length === 0) {
    throw new Error("All 5 launch subs are in IGNORED_SUBREDDITS — nothing to compose.");
  }

  const subKey = candidates[Math.floor(Math.random() * candidates.length)];
  const promptNumber = 1 + Math.floor(Math.random() * 3); // prompts are 1..3

  return [{ json: { subKey, promptNumber, trigger: "random" } }];
  ```

### Node 4 — Code: Use Chosen Sub + Prompt

- Type: `n8n-nodes-base.code`, `typeVersion: 2`
- Upstream: Node 2 only
- Logic (operator edits the top two consts before running):
  ```js
  // EDIT THESE BEFORE RUNNING:
  const targetSubreddit = "amex";   // one of: amex, awardtravel, ynab, delta, marriottbonvoy
  const promptNumber = 1;            // 1, 2, or 3

  const LAUNCH_SUBS = ["amex", "awardtravel", "ynab", "delta", "marriottbonvoy"];
  const subKey = targetSubreddit.trim().replace(/^r\//i, "").toLowerCase();

  if (!LAUNCH_SUBS.includes(subKey)) {
    throw new Error(`targetSubreddit must be one of ${LAUNCH_SUBS.join(", ")} — got "${subKey}"`);
  }
  if (!Number.isInteger(promptNumber) || promptNumber < 1 || promptNumber > 3) {
    throw new Error(`promptNumber must be 1, 2, or 3 — got ${promptNumber}`);
  }

  // Defensive ignore check.
  const ignoredRaw = $env.IGNORED_SUBREDDITS || "";
  const ignored = new Set(
    ignoredRaw.split(",").map(s => s.trim().replace(/^r\//i, "").toLowerCase()).filter(Boolean)
  );
  if (ignored.has(subKey)) {
    throw new Error(`Refusing to compose for ${subKey} — it is in IGNORED_SUBREDDITS.`);
  }

  return [{ json: { subKey, promptNumber, trigger: "chosen" } }];
  ```

### Node 5 — Code: Profile + Prompt Lookup

- Type: `n8n-nodes-base.code`, `typeVersion: 2`
- Upstream: **both** Node 3 and Node 4
- Contains the entire `SUBREDDIT_PROFILES` object with all 5 launch subs embedded
- Structure per sub entry:
  ```js
  SUBREDDIT_PROFILES["amex"] = {
    displayName: "r/amex",
    size: "527k",
    promotion: "INDIRECT",  // "INDIRECT" | "NAMED_COMPLEMENTARY" (never "DIRECT", never "AVOID" in the launch set)
    voice: "Knowledgeable Amex cardholder. Specific about benefit credits and reset calendars. First person, prose-heavy.",
    rules: [
      "Never name Fenrir or link fenrirledger.com in the body of the comment.",
      "May say 'I built a small tracker' or 'I use something I made for this' — once per thread max.",
      "May offer 'happy to share what I use if you want' as a soft follow-up.",
      "No cold link drops. No marketing-speak.",
      "No standalone promotional posts. No repeating the soft mention across multiple threads in the same week."
    ],
    jargon: ["MR", "AF", "Gold", "Plat", "Biz Plat", "BCE", "BCP", "NLL", "popup jail", "2/90", "PC", "Uber Cash", "airline fee credit", "CLEAR", "Equinox", "SUB", "Amex Offers"],
    topicHooks: [
      "Is the Amex Plat worth $695? — lead with credit-by-credit breakdown, then mention tracking.",
      "How do you track your benefit credits? — most direct opening; describe the reset-calendar pain.",
      "Thinking about downgrading Gold to Green — PC timing, AF date vs. statement date distinction.",
      "How do I keep the Plat benefits straight? — Uber Cash (monthly), airline credit (Jan reset), hotel credit (card year)."
    ],
    pitfall: "Mentioning a tracker in Amex Offers, award redemption, popup jail, or application strategy threads — those are off-topic for AF/benefit tracking.",
    lengthStyle: "4-8 sentences for AF decision threads. Prose, not bullets. Personal perspective.",
    prompts: [
      { id: 1, title: "Is the Plat worth $695?", type: "reply", prompt: "<full text from amex/001-is-plat-worth-695-reply.md>" },
      { id: 2, title: "Gold AF decision thread", type: "reply", prompt: "<full text from amex/002-gold-af-decision-thread-reply.md>" },
      { id: 3, title: "Tracking benefit credits thread", type: "reply", prompt: "<full text from amex/003-tracking-benefit-credits-thread-reply.md>" }
    ]
  };
  ```
- **The source for each field is the sub's `profile-reduced.md`** — copy the bullet lists, jargon array, topic hooks, and pitfall verbatim. The `prompts[].prompt` field is the full text of the corresponding `00N-*.md` prompt file.
- r/ynab's entry additionally sets `promotion: "NAMED_COMPLEMENTARY"` and has a specific `positioningFraming` field:
  ```js
  SUBREDDIT_PROFILES["ynab"] = {
    // ... other fields ...
    promotion: "NAMED_COMPLEMENTARY",
    positioningFraming: "YNAB tracks my spending. Fenrir tracks when my sign-up bonuses expire, when my annual fees are due, and whether I've hit the minimum spend. These are two different problems.",
    // ...
  };
  ```
- Output:
  ```js
  const { subKey, promptNumber, trigger } = $input.first().json;
  const profile = SUBREDDIT_PROFILES[subKey];
  if (!profile) {
    throw new Error(`No profile for sub: ${subKey}. Add it to SUBREDDIT_PROFILES.`);
  }
  if (profile.promotion === "DIRECT") {
    throw new Error(`DIRECT promotion is not allowed — should never be set.`);
  }
  const promptEntry = profile.prompts.find(p => p.id === promptNumber);
  if (!promptEntry) {
    throw new Error(`No prompt #${promptNumber} for ${subKey}.`);
  }

  return [{
    json: {
      subKey,
      displayName: profile.displayName,
      size: profile.size,
      promotion: profile.promotion,
      voice: profile.voice,
      rules: profile.rules,
      jargon: profile.jargon,
      topicHooks: profile.topicHooks,
      pitfall: profile.pitfall,
      lengthStyle: profile.lengthStyle,
      positioningFraming: profile.positioningFraming || null,
      promptId: promptEntry.id,
      promptTitle: promptEntry.title,
      promptType: promptEntry.type,
      promptText: promptEntry.prompt,
      trigger
    }
  }];
  ```

### Node 6 — Claude: Compose Post

- Type: `@n8n/n8n-nodes-langchain.anthropic`
- Credential: `anthropicApi` → id `anthropic-fenrir`, name `Anthropic (Fenrir)`
- Model: `claude-sonnet-4-20250514`
- Options:
  - `maxTokens: 512`
  - `system` (templated with n8n expression — built from the lookup fields):
    ```
    =You are Freya, posting on Reddit as u/Wide-Pass369. You are a 34-year-old churner in Denver, 3 years into the hobby, currently managing 12 active cards. You are NOT a marketer. You share real experience, numbers, and honest opinions.

    Subreddit: {{ $json.displayName }} ({{ $json.size }} subscribers)
    Promotion level: {{ $json.promotion }}

    Voice: {{ $json.voice }}

    Native jargon (use naturally): {{ $json.jargon.join(", ") }}

    Length + style: {{ $json.lengthStyle }}

    Pitfall to avoid: {{ $json.pitfall }}

    PROMOTION RULES (UNBREAKABLE):
    - If promotion is AVOID: zero product mention. No "I built", no tool name, no link. Pure value only.
    - If promotion is INDIRECT: you MAY say "I built a small tracker for this" ONCE per comment without naming Fenrir and without any link. Follow with "happy to share if you want" as a soft offer. Never name Fenrir. Never link fenrirledger.com.
    - If promotion is NAMED_COMPLEMENTARY: you MAY name "Fenrir Ledger" and include the link "fenrirledger.com" ONCE, but only in the final third of the comment, AND only after establishing the complementary positioning. For r/ynab specifically, use this framing: {{ $json.positioningFraming }}
    - DIRECT is NOT AN OPTION — if you see promotion=DIRECT, refuse and return the literal string "ERROR: DIRECT promotion is disabled".

    Hard rules specific to this sub:
    {{ $json.rules.map((r, i) => `${i+1}. ${r}`).join("\n") }}

    ANTI-DETECTION (UNBREAKABLE):
    Banned words: delve, utilize, moreover, furthermore, additionally, crucial, pivotal, navigate (as a verb for abstract things), landscape (for abstract topics), in the realm of, it is worth noting, tapestry, testament, paramount, seamlessly, powerful, game-changer.
    Write short paragraphs. First person. Conversational. No bullet lists unless the sub's style guidance above explicitly allows them. NEVER use em-dashes (use commas or periods instead).

    OUTPUT FORMAT (UNBREAKABLE):
    Return exactly two blocks, nothing else:

    TITLE: <the post or comment title — for replies/comments leave as "(reply — no title)">
    BODY: <the full post/comment body>

    Do not add any preamble, explanation, or markdown code fences.
    ```
  - Message content:
    ```
    =Prompt ({{ $json.promptType }}): {{ $json.promptTitle }}

    {{ $json.promptText }}
    ```

### Node 7 — Code: Format Draft Email

- Type: `n8n-nodes-base.code`, `typeVersion: 2`
- Upstream: Node 6
- Logic:
  ```js
  const input = $input.first().json;

  // Extract Claude text (handle multiple response shapes)
  const claudeText =
    input?.content?.[0]?.text ||
    input?.text ||
    input?.message?.content ||
    "";

  // Parse TITLE / BODY blocks
  const titleMatch = claudeText.match(/TITLE:\s*(.+?)\s*\nBODY:/s);
  const bodyMatch = claudeText.match(/BODY:\s*([\s\S]+)$/);

  if (!titleMatch || !bodyMatch) {
    throw new Error(`Claude output did not match TITLE:/BODY: format. Raw:\n${claudeText}`);
  }

  const rawTitle = titleMatch[1].trim();
  const body = bodyMatch[1].trim();

  if (body.startsWith("ERROR:")) {
    throw new Error(`Claude refused: ${body}`);
  }

  // Get upstream context from Node 5 via named node reference
  const ctx = $("Profile + Prompt Lookup").first().json;

  const title = rawTitle === "(reply — no title)" ? "" : rawTitle;
  const encodedTitle = title ? encodeURIComponent(title) : "";

  // Build the Reddit submit link
  const submitLink = title
    ? `https://www.reddit.com/r/${ctx.subKey}/submit?title=${encodedTitle}&selftext=true`
    : `https://www.reddit.com/r/${ctx.subKey}/`;

  // Post-hoc compliance check: INDIRECT subs must not contain "Fenrir" or "fenrirledger.com" in the body.
  // NAMED_COMPLEMENTARY subs may contain them.
  if (ctx.promotion === "INDIRECT" || ctx.promotion === "AVOID") {
    const lower = body.toLowerCase();
    if (lower.includes("fenrir") || lower.includes("fenrirledger.com")) {
      throw new Error(`Claude named Fenrir in a ${ctx.promotion} sub (${ctx.subKey}) — this is a hard rule violation. Aborting draft creation.`);
    }
  }

  return [{
    json: {
      subKey: ctx.subKey,
      displayName: ctx.displayName,
      promotion: ctx.promotion,
      promptId: ctx.promptId,
      promptTitle: ctx.promptTitle,
      promptType: ctx.promptType,
      title,
      body,
      submitLink,
      trigger: ctx.trigger
    }
  }];
  ```
- **Post-hoc compliance check**: the node now validates that Claude did not sneak "Fenrir" or "fenrirledger.com" into an INDIRECT or AVOID sub's output. This is a belt-and-suspenders safeguard on top of the system prompt.

### Node 8 — Gmail: Create Draft

- Type: `n8n-nodes-base.gmail`
- Resource: `draft`
- Operation: `create`
- Credential: `gmailOAuth2` → id `Eck5j1Xj1x6zyc9A`, name `Gmail account`
- Subject: `={{ "Reddit Post Draft: " + $json.displayName + " — " + ($json.title || "(reply)") }}`
- Message Type: HTML
- Message Body:
  ```html
  <h2>Reddit Post Draft</h2>
  <p>
    <strong>Subreddit:</strong> {{ $json.displayName }}<br/>
    <strong>Promotion level:</strong> {{ $json.promotion }}<br/>
    <strong>Prompt:</strong> #{{ $json.promptId }} — {{ $json.promptTitle }} ({{ $json.promptType }})<br/>
    <strong>Trigger mode:</strong> {{ $json.trigger }}
  </p>

  <hr/>

  <h3>Composed Title</h3>
  <p><strong>{{ $json.title || "(reply — no title)" }}</strong></p>

  <h3>Composed Body</h3>
  <div style="background:#f5f5f5;padding:12px;border-left:3px solid #c9920a;white-space:pre-wrap;font-family:Georgia,serif;">{{ $json.body }}</div>

  <hr/>

  <h3>Post it</h3>
  <p>
    👉 <a href="{{ $json.submitLink }}"><strong>Open Reddit submit page</strong></a>
  </p>
  <p style="font-size:12px;color:#666;">
    Click the link above, paste the body into Reddit, review one more time, then submit as u/Wide-Pass369.<br/>
    Delete this draft when done.
  </p>
  ```

---

## Data Sources for `SUBREDDIT_PROFILES`

For each of the 5 launch subs, the embedded entry is built from **two files**:

| Field | Source |
|---|---|
| `displayName`, `size`, `promotion` | `profile-reduced.md` frontmatter |
| `voice` | `profile-reduced.md` — "Voice" section |
| `rules` | `profile-reduced.md` — "Rules (UNBREAKABLE)" bullet list |
| `jargon` | `profile-reduced.md` — "Jargon (use naturally)" comma list |
| `topicHooks` | `profile-reduced.md` — "Topic hooks" bullet list |
| `pitfall` | `profile-reduced.md` — "Pitfall" section |
| `lengthStyle` | `profile-reduced.md` — "Length + style" section |
| `positioningFraming` (r/ynab only) | `profile-reduced.md` — "Framing that works" verbatim example |
| `prompts[].title` | Inferred from the filename of `001-*.md`, `002-*.md`, `003-*.md` |
| `prompts[].type` | Inferred from filename suffix (`-reply`, `-tip`, `-standalone-post`) or from the file's "post type" field |
| `prompts[].prompt` | Full body of `001-*.md` / `002-*.md` / `003-*.md` |

**Copy verbatim** — do not paraphrase, do not re-tighten. The reduced files are already tight; any drift would poison the embed.

---

## Conventions (match existing workflows)

Reference: `infrastructure/n8n/workflows/gmail-reddit-monitor.json` and `gmail-f5bot-monitor.json`.

- **Node IDs:** UUIDs. IF node conditions MUST have UUID ids (n8n v2 silently drops non-UUID conditions on import).
- **Root fields:**
  ```json
  {
    "name": "Reddit Post Composer",
    "active": false,
    "nodes": [ ... ],
    "connections": { ... },
    "settings": {
      "executionOrder": "v1",
      "saveManualExecutions": true
    },
    "tags": []
  }
  ```
- **Code nodes:** `typeVersion: 2`, language JavaScript
- **Gmail node:** use the `gmailOAuth2` credential by ID (`Eck5j1Xj1x6zyc9A`)
- **Anthropic node:** use the `anthropicApi` credential by ID (`anthropic-fenrir`), type `@n8n/n8n-nodes-langchain.anthropic`
- **`active: false`** — imported inactive, Odin activates manually in the UI
- **Connections:** Node 3 → Node 5, Node 4 → Node 5 (both triggers feed the same lookup)

---

## Validation Plan

All validation is JSON-level. No tsc, no build, no Vitest — n8n workflows have no test infra.

1. **JSON syntax:**
   ```bash
   jq empty infrastructure/n8n/workflows/reddit-post-composer.json
   ```

2. **Shape check:**
   ```bash
   node -e '
   const wf = require("./infrastructure/n8n/workflows/reddit-post-composer.json");
   if (wf.active !== false) throw new Error("active must be false");
   if (!Array.isArray(wf.nodes) || wf.nodes.length === 0) throw new Error("must have nodes");
   if (!wf.connections || typeof wf.connections !== "object") throw new Error("must have connections");
   if (!wf.settings || wf.settings.executionOrder !== "v1") throw new Error("settings.executionOrder must be v1");
   console.log("ok:", wf.nodes.length, "nodes");
   '
   ```

3. **UUID check:**
   ```bash
   node -e '
   const wf = require("./infrastructure/n8n/workflows/reddit-post-composer.json");
   const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
   for (const n of wf.nodes) {
     if (!uuid.test(n.id)) throw new Error("non-UUID node id: " + n.id);
   }
   console.log("ok: all node ids are UUIDs");
   '
   ```

4. **Forbidden subs check:**
   ```bash
   # r/CreditCardChurning must not appear anywhere
   ! grep -i "CreditCardChurning" infrastructure/n8n/workflows/reddit-post-composer.json
   # Standalone r/churning must not appear (r/churningcanada is not in launch set anyway)
   ! grep -E '"churning"|r/churning[^c+]' infrastructure/n8n/workflows/reddit-post-composer.json
   ```

5. **No DIRECT level:**
   ```bash
   # "DIRECT" should only appear in defensive error-throwing checks, never as an active promotion level
   ! grep -E 'promotion[[:space:]]*:[[:space:]]*"DIRECT"' infrastructure/n8n/workflows/reddit-post-composer.json
   ```

6. **Launch set coverage:**
   ```bash
   for sub in amex awardtravel ynab delta marriottbonvoy; do
     grep -q "\"$sub\"" infrastructure/n8n/workflows/reddit-post-composer.json || echo "MISSING: $sub"
   done
   ```

7. **Only launch subs are present** (no stray 17-sub entries):
   ```bash
   # Count sub entries in SUBREDDIT_PROFILES — expect exactly 5
   node -e '
   const wf = require("./infrastructure/n8n/workflows/reddit-post-composer.json");
   const lookup = wf.nodes.find(n => n.name && n.name.toLowerCase().includes("lookup"));
   const code = lookup.parameters.jsCode || lookup.parameters.code || "";
   const keys = [...code.matchAll(/SUBREDDIT_PROFILES\[\s*"([^"]+)"\s*\]/g)].map(m => m[1]);
   const unique = [...new Set(keys)];
   if (unique.length !== 5) throw new Error("expected 5 subs in SUBREDDIT_PROFILES, got " + unique.length + ": " + unique.join(","));
   const expected = ["amex", "awardtravel", "ynab", "delta", "marriottbonvoy"];
   for (const s of expected) if (!unique.includes(s)) throw new Error("missing: " + s);
   console.log("ok: exactly 5 launch subs");
   '
   ```

8. **Import test:**
   ```bash
   /n8n-workflow import reddit-post-composer
   ```
   Expect the workflow appears at `https://marketing.fenrirledger.com/` with status=inactive.

9. **Manual trigger test (node-by-node):**
   - **Trigger — Random:** execute. Node 3 outputs a `subKey` from the launch set. Node 5 resolves to a profile. Node 6 returns text with `TITLE:` and `BODY:`. Node 7 produces a `submitLink` starting with `https://www.reddit.com/r/<sub>/submit?title=...&selftext=true`. Node 8 returns a draft `id`.
   - **Trigger — Chosen:** set `targetSubreddit = "ynab"` in Node 4, execute. Expect `subKey: "ynab"` and `promotion: "NAMED_COMPLEMENTARY"` through the chain.
   - **Defensive test 1:** set `targetSubreddit = "churning"` in Node 4 → Node 4 throws `targetSubreddit must be one of...`.
   - **Defensive test 2:** set `targetSubreddit = "amex"` in Node 4 but ensure `IGNORED_SUBREDDITS` contains `r/amex` → Node 4 throws `Refusing to compose for amex`.

10. **Gmail verification:** open Freya's Drafts folder, confirm:
    - Subject matches `Reddit Post Draft: r/<sub> — <title>`
    - HTML renders cleanly, Reddit submit link resolves to the correct sub

11. **Content quality spot check per sub** (manually review one draft per sub):
    - **r/amex, r/awardtravel, r/delta, r/marriottbonvoy:** body contains NO "Fenrir" and NO "fenrirledger.com" (post-hoc check in Node 7 enforces this, but verify manually too)
    - **r/ynab:** body may contain "Fenrir Ledger" and "fenrirledger.com" — verify the positioning framing is complementary ("YNAB for X, Fenrir for Y") and not competitive
    - All subs: no em-dashes (—), no banned words (delve, utilize, pivotal, seamlessly, etc.)

---

## Critical Files

| Path | Action |
|---|---|
| `infrastructure/n8n/workflows/reddit-post-composer.json` | **NEW** — the workflow (8 nodes) |

## Reused Assets (do not modify)

| Asset | Location | Purpose |
|---|---|---|
| `anthropic-fenrir` credential | n8n credential store | Anthropic API auth |
| `Eck5j1Xj1x6zyc9A` Gmail OAuth2 credential | n8n credential store | Gmail draft creation |
| `infrastructure/n8n/workflows/gmail-reddit-monitor.json` | repo | Reference for Claude + Gmail node shape, Freya persona |
| `infrastructure/n8n/workflows/gmail-f5bot-monitor.json` | repo | Reference for Gmail draft HTML format |
| `product/research/reddit/amex/profile-reduced.md` | repo | Source for embedded amex profile |
| `product/research/reddit/awardtravel/profile-reduced.md` | repo | Source for embedded awardtravel profile |
| `product/research/reddit/ynab/profile-reduced.md` | repo | Source for embedded ynab profile (NAMED_COMPLEMENTARY) |
| `product/research/reddit/delta/profile-reduced.md` | repo | Source for embedded delta profile |
| `product/research/reddit/marriottbonvoy/profile-reduced.md` | repo | Source for embedded marriottbonvoy profile |
| `product/research/reddit/<sub>/00{1,2,3}-*.md` × 15 | repo | Source of prompt text (3 per launch sub) |
| `/n8n-workflow` skill | `.claude/skills/n8n-workflow/SKILL.md` | Import mechanism |

## Out of Scope

- **No ConfigMap changes** — launch set is hardcoded in the workflow, not driven by `PREFERRED_SUBREDDITS`
- **No Helm changes** — no new env refs, no credentials
- **No activation** — imports inactive, Odin activates in UI after verification
- **No DIRECT promotion path** — absent by design (YAGNI)
- **No HTTP fetch of profile-reduced.md** — embedded inline per Odin's decision
- **No drift-detection script** — listed as follow-up risk; manual review for the launch build
- **No Vitest/tsc/build** — n8n workflow JSON has no test infra; validation is jq + node shape checks
- **Subs 6-17** — not in the launch set; expand after launch validates

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Claude returns content that doesn't match `TITLE:/BODY:` format | Node 7 throws loudly with the raw text, surfacing the failure to the operator for prompt tuning |
| Claude ignores promotion level and emits "Fenrir" in an INDIRECT sub | Node 7 post-hoc compliance check throws before creating the Gmail draft. If it fires, tighten the system prompt |
| Claude emits competitive positioning in r/ynab (violating NAMED_COMPLEMENTARY rules) | Manual review at step 11. If this happens repeatedly, add a second compliance check that requires the body to contain the word "YNAB" when promotion is NAMED_COMPLEMENTARY |
| Anthropic node response shape changes across n8n versions | Node 7 handles 3 possible shapes (`content[0].text`, `text`, `message.content`) |
| Operator edits Node 4 with a non-launch sub | Node 4 throws `targetSubreddit must be one of...` before reaching Claude |
| `profile-reduced.md` drifts from embedded `SUBREDDIT_PROFILES` | Manual review on each PR. Follow-up: add `scripts/validate-reddit-composer-sync.mjs` to automatically detect drift in CI |
| Reddit submit link format changes | Low risk — `submit?title=X&selftext=true` has been stable for years |
| Too-large system prompt | With only 5 subs and concise reduced profiles, the system prompt stays well under 2000 tokens |
| n8n v2 drops non-UUID IF condition IDs silently | Validation step 3 enforces UUIDs for all node IDs |

---

## Implementation Order

When writing the JSON file, work in this order so each step can be committed+validated:

1. **Skeleton:** root fields, empty nodes array, empty connections — validate with `jq empty`
2. **Node 1 + Node 2** (both triggers) — validate shape
3. **Node 3** (random picker) — validate JS parses, matches launch set
4. **Node 4** (chosen picker) — validate JS parses, matches launch set
5. **Node 5 skeleton** — empty `SUBREDDIT_PROFILES` object + the lookup/error logic — validate
6. **Node 6** (Claude) — validate credential reference, model name, system prompt template
7. **Node 7** (format + compliance check) — validate JS parses
8. **Node 8** (Gmail draft) — validate credential reference, template
9. **Wire connections:** triggers → pickers → lookup → Claude → format → gmail
10. **Backfill SUBREDDIT_PROFILES:** one sub at a time, in order: amex → awardtravel → ynab → delta → marriottbonvoy. Copy each field verbatim from the corresponding `profile-reduced.md` and the 3 prompt files. Commit after each sub.
11. **Full validation suite** (steps 1-7 in the validation plan above)
12. **Import + manual trigger test** — run the Random trigger once, check the draft. Run Chosen with `ynab` once, check the draft.
