# Target Market — Credit Card Churners

## Who They Are

Credit card churners open cards strategically for signup bonuses, then close or downgrade before annual fees hit. They track dozens of cards, juggle minimum spend deadlines, and optimize rewards across issuers. Their biggest pain: spreadsheet chaos and missed deadlines that cost real money.

**Primary persona:** Active churner managing 5-30+ cards across multiple issuers. Tracks annual fees, bonus deadlines, and card statuses manually (usually Google Sheets or Excel). Tech-comfortable, values automation, hates losing money to forgotten fees.

**Secondary persona:** Casual optimizer with 3-8 cards. Not a hardcore churner but wants to avoid annual fee traps and track rewards. Discovers Fenrir via community recommendations.

## Where They Live Online

| Community | Size | Culture | Engagement Rules |
|-----------|------|---------|-----------------|
| r/churning | ~300k | Strict moderation. No self-promotion. Help-first. Weekly threads for questions. | Earn karma via helpful data points and answers. Never shill. Mods ban fast. |
| r/creditcards | ~800k | More casual. Card recommendation requests common. Broader audience. | Helpful advice welcome. Subtle tool mentions OK in context. |
| r/CreditCardChurning | ~15k | Smaller, less moderated. More tool-friendly. | Direct recommendations more accepted. Good for early traction. |

## Value Proposition (by persona pain)

| Pain | Fenrir Solves It | How to Message |
|------|-----------------|----------------|
| Annual fee surprises | Fee date tracking + Howl notifications | "Never pay a fee you didn't plan for" |
| Spreadsheet overload | Structured card ledger with status tracking | "Your spreadsheet is a liability" |
| Bonus deadline misses | Deadline tracking + status badges | "Missed a $500 bonus? That's what we prevent" |
| Multi-device access | Cloud sync (Karl tier) | "Your card data, everywhere" |
| No good free tools | Fenrir is free (Thrall tier) | "Free forever. No bait-and-switch." |

## Engagement Strategy

### Phase: Reputation Building (Current)

**Channel:** Reddit only. **Budget:** $0. **Identity:** u/FenrirLedger brand account.

**Approach:** Value-first lurker. Establish credibility through genuinely helpful comments before any product mention. Freya monitors Reddit manually, identifies threads, drafts replies.

### Thread Selection Criteria

**Engage when:**
- Someone asks "how do you track your cards/annual fees/bonuses?"
- Someone shares a spreadsheet template and asks for feedback
- Someone posts about missing a fee deadline or bonus deadline
- "What tools do you use for churning?" threads
- Frustration posts about card management complexity
- New churner asking how to get organized

**Skip when:**
- Thread is about card recommendations (not tracking)
- Thread is about credit score optimization (different problem)
- Thread has <5 upvotes and <3 comments (low visibility)
- Thread is >48 hours old (engagement window closed)
- Any thread where mentioning a tool would feel forced

### Reply Patterns

**Phase 1 — Pure value (weeks 1-6, no product mention):**
- Share data points: "I track X cards and here's how I organize annual fee dates..."
- Answer questions with specific, actionable advice
- Upvote and engage with other helpful answers
- Share churning tips and strategies (not tool-related)

**Phase 2 — Natural mentions (weeks 7+, only when relevant):**
- "I built a tracker for this exact problem — [link]" (only in "what tools" threads)
- "I was tired of my spreadsheet breaking so I made something — happy to share"
- Never reply to your own comments with the link. One mention per thread max.

### Reply Template

```
[Acknowledge the specific problem they described]
[Share a concrete tip or data point from personal experience]
[If Phase 2 and thread fits: one-line natural mention, never the focus]
```

**Example (Phase 1):**
> I track 14 active cards and the biggest thing that saved me was setting
> calendar reminders 60 days before each annual fee date. Gives you time
> to call for a retention offer or downgrade. The 30-day window most
> people use is too tight — you forget, life happens, and suddenly you're
> out $495.

**Example (Phase 2):**
> I had the same problem — my spreadsheet got unwieldy around card #10.
> I ended up building a tracker that handles fee dates and bonus deadlines
> automatically. Happy to share if you're interested. But honestly, even
> a simple Google Sheet with conditional formatting on dates would solve
> 80% of this.

### Monitoring Cadence

| Task | Frequency | Owner |
|------|-----------|-------|
| Scan r/churning daily thread | Daily | Freya |
| Scan r/creditcards new posts | Daily | Freya |
| Scan r/CreditCardChurning | 2x/week | Freya |
| Draft reply batch | Weekly | Freya |
| Review reply performance | Weekly | Freya |
| Report to Odin | Bi-weekly | Freya |
| Escalate high-value threads | As needed | Freya -> Odin |

### Reputation Milestones

| Milestone | Target | Signal |
|-----------|--------|--------|
| Account established | Week 1 | u/FenrirLedger created, subscribed to all 3 subs |
| First karma | Week 2 | 50+ comment karma from helpful replies |
| Recognized helper | Week 4 | 200+ karma, replies getting upvoted consistently |
| Trusted voice | Week 6 | 500+ karma, other users replying positively |
| Soft reveal ready | Week 7 | Karma threshold met, natural mention opportunity identified |
| Community presence | Week 12 | 1000+ karma, Fenrir mentioned by others organically |

### Success Metrics (90-day)

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Comment karma | 1000+ | Reddit profile |
| Helpful replies posted | 60+ | Manual count |
| Organic Fenrir mentions (by others) | 5+ | Reddit search |
| Signups from Reddit | 50+ | UTM tracking on landing page links |
| Feedback items filed | 10+ | GitHub issues from Reddit users |
| Brand account not banned | Yes | Still active on all 3 subs |

### Automation Evaluation (Future)

**Evaluate at Week 12.** Consider automating only if:
- Manual monitoring takes >30 min/day consistently
- Thread patterns are predictable enough to filter programmatically
- Engagement quality won't drop (automated replies get banned fast)

**What could be automated:**
- Thread discovery and filtering (RSS, Reddit API, keyword alerts)
- Daily digest of candidate threads for Freya to review
- Karma and engagement metric tracking

**What stays manual:**
- Reply drafting (authenticity matters, templates are starting points not scripts)
- Thread selection (context judgment can't be automated safely)
- Escalation decisions
