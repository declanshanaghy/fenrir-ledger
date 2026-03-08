# Reddit Success Metrics and Phase Gate Criteria

**Status**: Active | **Owner**: Freya | **Ref**: Issue #321
**Last updated**: 2026-03-08 | **Next review**: Weekly during campaign

> **Purpose**: Measurable success criteria and phase gate requirements for the Reddit soft launch campaign.
> All metrics must be verifiable from Reddit profile stats, tracking log (#305), or UTM analytics.

---

## 1. Phase Gate Criteria

All criteria must be met to advance to the next phase. No exceptions.

| Phase Transition | Gate Criteria | Verification Method | Decision Owner |
|---|---|---|---|
| **Phase 1 → 2** | ✓ u/FenrirLedger account created<br>✓ Subreddit rules documented in subreddit-profiles.md (#318)<br>✓ Comment templates drafted in marketing-campaign-plan.md (#319)<br>✓ Engagement tracking log initialized at reddit-engagement-log.md (#305)<br>✓ UTM tracking configured in landing page | Reddit profile exists<br>File review<br>File review<br>File exists with headers<br>Test link with UTM params | Freya |
| **Phase 2 → 3** | ✓ 50+ comment karma on u/FenrirLedger<br>✓ 20+ genuine value-add comments posted<br>✓ >70% positive reply ratio (upvoted or replied to)<br>✓ 0 mod warnings, removals, or bans<br>✓ Account age >30 days<br>✓ At least 3 comments with 10+ upvotes | Reddit profile stats<br>Tracking log count<br>Tracking log analysis<br>Reddit inbox + mod messages<br>Account creation date<br>Tracking log upvotes column | Odin review |
| **Phase 3 → 4** | ✓ 3+ natural Fenrir mentions posted in relevant threads<br>✓ 0 mod removals of Fenrir mentions<br>✓ Positive sentiment (>50% upvoted) on all mentions<br>✓ Modmail sent to r/churning requesting guidance<br>✓ 200+ total karma<br>✓ At least 10 signups with Reddit UTM attribution | Comment links in tracking log<br>Reddit inbox review<br>Reddit comment scores<br>Screenshot of modmail<br>Reddit profile stats<br>Analytics dashboard | Odin approval |
| **Phase 4 (ongoing)** | ✓ Weekly engagement maintained (3-5 comments/week)<br>✓ "I Built This" post live with >10 upvotes<br>✓ 10:1 help-to-promotion ratio maintained<br>✓ No community backlash or mod interventions<br>✓ 50+ signups/month from Reddit<br>✓ Organic mentions by other users appearing | Tracking log cadence<br>Post score on Reddit<br>Tracking log ratio<br>Reddit inbox + comments<br>Analytics UTM report<br>Reddit search for "Fenrir" | Weekly review |

**Hard stops**: Any of these immediately pause the campaign for strategy review:
- Mod warning or temporary ban on any target subreddit
- Mass downvoting pattern (3+ comments at -5 or worse)
- Accusation of shilling/astroturfing gaining traction
- Competitor directly challenging Fenrir claims
- Reddit-wide shadowban indicators

---

## 2. KPI Definitions

### 2.1 Engagement Metrics

| Metric | Definition | How to Measure | Target Threshold | Tracking Location |
|---|---|---|---|---|
| **Comment Karma** | Total karma on u/FenrirLedger profile | Visit reddit.com/u/FenrirLedger | Phase 2: 50+<br>Phase 3: 200+<br>Phase 4: 500+ | Weekly in tracking log header |
| **Comment Count** | Number of comments posted across all subs | Count rows in tracking log | Phase 2: 20+<br>Phase 3: 35+<br>Phase 4: 60+ | Tracking log row count |
| **Comments per Sub** | Breakdown by subreddit | Filter tracking log by subreddit column | r/churning: 40%<br>r/creditcards: 40%<br>r/CCC: 20% | Tracking log pivot |
| **Positive Reply Ratio** | % of comments that receive upvotes OR replies | (Upvoted + Replied) / Total | >70% for Phase 2→3<br>>80% ongoing | Calculate from tracking log |
| **High-Value Comments** | Comments with 10+ upvotes | Count where upvotes ≥10 | Phase 2: 3+<br>Phase 3: 5+<br>Phase 4: 10+ | Tracking log filter |
| **Mod Interactions** | Warnings, removals, or bans | Check Reddit inbox + modmail | Target: 0 always | Document in tracking log notes |
| **Reply Engagement** | Direct replies to Freya's comments | Count reply notifications | Phase 2: 5+<br>Phase 3: 15+<br>Phase 4: 30+ | Tracking log "Replies" column |

### 2.2 Product Mention Metrics

| Metric | Definition | How to Measure | Target Threshold | Tracking Location |
|---|---|---|---|---|
| **Mention Count** | Times Fenrir is referenced by u/FenrirLedger | Search user's comment history | Phase 3: 3-5<br>Phase 4: 1-2/week max | Tracking log with [MENTION] tag |
| **Mention Reception** | Upvote ratio on mentions | Reddit comment score | All mentions >0 (net positive) | Tracking log upvotes |
| **Organic Mentions** | Other users mentioning Fenrir | Reddit search "Fenrir Ledger" | Phase 4: 1+/month | Screenshot + tracking log |
| **Help-to-Promo Ratio** | Non-promotional vs promotional comments | Count [MENTION] tags | Maintain 10:1 minimum | Calculate from tracking log |

### 2.3 Conversion Metrics

| Metric | Definition | How to Measure | Target Threshold | Tracking Location |
|---|---|---|---|---|
| **Click-through Rate** | Unique visitors from Reddit links | GA4 UTM report | Phase 3: 50+<br>Phase 4: 200+/month | Analytics dashboard |
| **Signup Rate** | New accounts from Reddit UTM | Filter signups by utm_source=reddit | Phase 3: 10+<br>Phase 4: 50+/month | Database + analytics |
| **Activation Rate** | Reddit users who add 2+ cards | Segment by UTM, count cards | >40% within 7 days | User analytics query |
| **Retention** | Reddit users returning after 7 days | Cohort by UTM source | >30% 7-day retention | Retention dashboard |
| **Referral Quality** | Avg cards/user from Reddit | Segment by acquisition source | Higher than organic avg | Monthly analysis |

### 2.4 Community Sentiment

| Metric | Definition | How to Measure | Target Threshold | Tracking Location |
|---|---|---|---|---|
| **Sentiment Score** | Qualitative assessment of tone | Manual review of replies/mentions | Positive/Neutral only | Weekly notes in log |
| **Trust Indicators** | Users asking follow-up questions | Count question replies | Increasing trend | Tracking log replies |
| **Backlash Events** | Negative callouts or challenges | Monitor for "shill", "spam", "ad" | Zero tolerance | Immediate escalation |
| **Moderator Stance** | Mod team response to Fenrir | Review any mod interactions | Neutral to positive | Document all contact |

---

## 3. Tracking Cadence

### 3.1 Daily Tasks (15-20 minutes)

**Every weekday morning:**
- [ ] Check u/FenrirLedger karma (log if changed)
- [ ] Review overnight replies/messages
- [ ] Scan new posts in all 3 subreddits
- [ ] Identify 1-2 engagement opportunities
- [ ] Post comments if relevant threads found

**What to track daily:**
- New comment URLs posted
- Immediate upvote/downvote patterns
- Any mod messages or removals

### 3.2 Weekly Tasks (45-60 minutes)

**Every Friday:**
- [ ] Update tracking log with week's metrics
- [ ] Calculate positive reply ratio
- [ ] Review sentiment on all comments
- [ ] Count high-value comments (10+ upvotes)
- [ ] Check for organic Fenrir mentions
- [ ] Pull UTM analytics for Reddit traffic
- [ ] Update reddit-engagement-log.md
- [ ] Flag any issues for Odin review

**Weekly metrics snapshot:**
```markdown
## Week of [DATE]
- Total Karma: [NUMBER] (+[CHANGE])
- Comments This Week: [COUNT]
- Positive Reply Ratio: [PERCENT]%
- High-Value Comments: [COUNT]
- Reddit Visitors: [COUNT]
- Signups: [COUNT]
- Notes: [OBSERVATIONS]
```

### 3.3 Phase Gate Reviews

**Before requesting phase advancement:**
1. Compile all gate criteria evidence
2. Screenshot Reddit profile stats
3. Export tracking log summary
4. Pull UTM attribution report
5. Document any risks or concerns
6. Create phase transition issue in GitHub
7. Tag Odin for approval decision

**Phase gate checklist template:**
```markdown
## Phase [X] → [Y] Gate Review

**Date**: [DATE]
**Requestor**: Freya
**Approver**: Odin

### Criteria Checklist
- [ ] [Criterion 1]: [EVIDENCE]
- [ ] [Criterion 2]: [EVIDENCE]
- [ ] [Criterion 3]: [EVIDENCE]

### Supporting Data
- Current karma: [NUMBER]
- Total comments: [COUNT]
- Mention count: [COUNT]
- Signups from Reddit: [COUNT]

### Risk Assessment
- [Any concerns or red flags]

### Recommendation
- [ ] Proceed to Phase [Y]
- [ ] Hold in Phase [X] - reason: [DETAIL]
```

---

## 4. UTM Link Strategy

### 4.1 UTM Parameter Structure

All Reddit links to Fenrir must include UTM parameters for attribution:

**Base structure:**
```
https://fenrir-ledger.dshanaghy.com/?utm_source=reddit&utm_medium=organic&utm_campaign=soft-launch&utm_content=[SUBREDDIT]_[THREAD_TYPE]
```

**Parameter definitions:**
- `utm_source`: Always "reddit"
- `utm_medium`: "organic" for comments, "post" for dedicated posts
- `utm_campaign`: "soft-launch" through Phase 4, then "community"
- `utm_content`: Specific format below

### 4.2 Content Parameter Taxonomy

| Subreddit | Thread Type | utm_content Value | Example |
|---|---|---|---|
| r/churning | Daily Discussion | churning_dd | `utm_content=churning_dd` |
| r/churning | Daily Question | churning_dq | `utm_content=churning_dq` |
| r/churning | What Card thread | churning_wcyg | `utm_content=churning_wcyg` |
| r/churning | Other thread | churning_general | `utm_content=churning_general` |
| r/churning | "I Built This" post | churning_ibuilt | `utm_content=churning_ibuilt` |
| r/creditcards | Question thread | creditcards_question | `utm_content=creditcards_question` |
| r/creditcards | Discussion thread | creditcards_discussion | `utm_content=creditcards_discussion` |
| r/creditcards | "I Built This" post | creditcards_ibuilt | `utm_content=creditcards_ibuilt` |
| r/CreditCardChurning | Any thread | ccc_general | `utm_content=ccc_general` |
| r/CreditCardChurning | "I Built This" post | ccc_ibuilt | `utm_content=ccc_ibuilt` |

### 4.3 Link Generation Process

1. Copy base URL: `https://fenrir-ledger.dshanaghy.com/`
2. Add UTM parameters using the taxonomy above
3. Test link in incognito to verify it loads
4. Use markdown format in Reddit: `[Fenrir Ledger](FULL_URL_WITH_UTM)`
5. Log the full URL in tracking log for that comment

### 4.4 Analytics Configuration

**GA4 setup required:**
- [ ] Verify UTM parameters are captured in GA4
- [ ] Create Reddit-specific dashboard with filters:
  - Traffic where utm_source = "reddit"
  - Breakdown by utm_content
  - Conversion funnel: Visit → Signup → Activation
- [ ] Set up weekly email report to Freya and Odin
- [ ] Configure alerts for spike detection (>50 visits/day)

**Key reports to monitor:**
1. **Acquisition**: Sessions by utm_content value
2. **Behavior**: Bounce rate by subreddit source
3. **Conversion**: Signup rate by thread type
4. **Retention**: 7-day return rate for Reddit cohort

---

## 5. Tracking Log Structure

### 5.1 Reddit Engagement Log Format

Location: `/workspace/designs/product/backlog/reddit-engagement-log.md`

```markdown
# Reddit Engagement Tracking Log

**Campaign**: Reddit Soft Launch
**Account**: u/FenrirLedger
**Phase**: [CURRENT_PHASE]

## Current Metrics
- **Total Karma**: [NUMBER] (as of [DATE])
- **Total Comments**: [COUNT]
- **Positive Reply Ratio**: [PERCENT]%
- **High-Value Comments**: [COUNT]
- **Signups from Reddit**: [COUNT]

## Engagement Log

| Date | Time | Subreddit | Thread Title | Comment URL | Upvotes | Replies | Mention? | UTM Link | Notes |
|------|------|-----------|--------------|-------------|---------|---------|----------|----------|-------|
| 2026-03-XX | 9:15am ET | r/churning | Daily Question Thread | [link] | 5 | 2 | No | N/A | Good traction |
| 2026-03-XX | 2:30pm ET | r/creditcards | "Which card for groceries?" | [link] | 12 | 3 | No | N/A | High engagement |
| 2026-03-XX | 10:00am ET | r/churning | "Tracker recommendations?" | [link] | 8 | 1 | Yes | [utm_link] | First mention |

## Weekly Summaries

### Week of 2026-03-XX
- Comments posted: X
- Average upvotes: X
- Karma gained: +X
- Mention count: X
- Reddit visitors: X
- Signups: X
- Notable events: [any mod interactions, high-engagement threads, etc.]

## Phase Gate Reviews

### Phase 1 → 2 Review (DATE)
- [Checklist and evidence]

### Phase 2 → 3 Review (DATE)
- [Checklist and evidence]
```

### 5.2 Automated vs Manual Tracking

**Must be manual:**
- Sentiment assessment
- Comment quality review
- Mod interaction documentation
- Community backlash detection

**Can be semi-automated:**
- Karma tracking (daily check, log changes)
- UTM traffic reports (weekly GA4 export)
- Signup attribution (database query)
- Comment count (tracking log row count)

**Never automate:**
- Comment posting
- Upvoting/downvoting
- Account creation or management

---

## 6. Red Flags and Escalation

### 6.1 Immediate Escalation Triggers

If any occur, pause all Reddit activity and escalate to Odin:

1. **Mod intervention**: Warning, post removal, or ban
2. **Shadowban indicators**: Comments visible when logged in but not logged out
3. **Brigading**: Coordinated downvoting across multiple comments
4. **Doxxing attempt**: Users trying to identify Odin as founder
5. **Competitor callout**: Direct challenge from AwardWallet, MaxRewards, etc.
6. **Viral negative thread**: Any Fenrir mention getting negative traction

### 6.2 Escalation Process

1. **Stop**: Cease all Reddit activity immediately
2. **Document**: Screenshot everything relevant
3. **Assess**: Determine severity and scope
4. **Notify**: Create urgent GitHub issue, tag Odin
5. **Wait**: Do not respond until strategy is agreed

### 6.3 Recovery Strategies

**For mod warning:**
- Apologize if warranted
- Clarify intent as community member
- Offer to adjust approach
- Wait 2 weeks before resuming

**For shadowban:**
- Appeal through Reddit.com/appeal
- May need new account (nuclear option)
- Preserve tracking history

**For community backlash:**
- Do not defend immediately
- Let 24 hours pass
- Respond only if constructive
- Focus on product improvements based on feedback

---

## 7. Success Indicators

### 7.1 Phase 2 Success (Karma Building)

✅ **You're succeeding when:**
- Comments getting 5+ upvotes regularly
- Users asking follow-up questions
- No comments below 0 karma
- Starting to recognize usernames who engage

⚠️ **Warning signs:**
- Multiple comments at 0 or -1
- No replies to comments
- Posting frequently but karma not growing
- Same users downvoting repeatedly

### 7.2 Phase 3 Success (Soft Reveal)

✅ **You're succeeding when:**
- Product mentions stay positive (>0 karma)
- Users click through to landing page
- Questions about features (not accusations)
- Some users trying the product

⚠️ **Warning signs:**
- "This is an ad" comments
- Immediate downvotes on mentions
- Mod removal of product mention
- No clicks despite mentions

### 7.3 Phase 4 Success (Community Presence)

✅ **You're succeeding when:**
- Other users mention Fenrir organically
- "I Built This" post gets >10 upvotes and genuine questions
- Consistent signup flow from Reddit (50+/month)
- Invited to participate in tool comparison threads
- Veterans treating u/FenrirLedger as community member

⚠️ **Warning signs:**
- Plateau in karma growth
- Declining engagement on comments
- Signup rate dropping
- Competitors explicitly positioning against Fenrir

---

## 8. Reporting Template

### 8.1 Weekly Report to Odin

**Subject**: Reddit Campaign - Week [X] Report

```markdown
## Reddit Soft Launch - Week [X]

**Phase**: [CURRENT]
**Health**: 🟢 Green | 🟡 Yellow | 🔴 Red

### Key Metrics
- Karma: [CURRENT] (+[WEEKLY_CHANGE])
- Comments: [WEEKLY] / [TOTAL]
- Signups: [WEEKLY] / [TOTAL]
- Top Thread: [TITLE] ([UPVOTES] upvotes)

### Highlights
- [Key win or learning]
- [Notable community interaction]
- [Product feedback captured]

### Concerns
- [Any risks or issues]

### Next Week Focus
- [Planned emphasis areas]

### Phase Gate Status
- [X] days until gate review
- On track: Yes/No
- Blockers: [LIST]
```

### 8.2 Phase Gate Report

**Subject**: Phase [X]→[Y] Gate Review Request

```markdown
## Phase Transition Request

**Current Phase**: [X]
**Requested Phase**: [Y]
**Date**: [DATE]

### Gate Criteria Status
✅ [MET CRITERION]
✅ [MET CRITERION]
⬜ [PENDING CRITERION] - [EXPECTED DATE]

### Evidence Package
1. Reddit profile: [SCREENSHOT]
2. Tracking log: [SUMMARY]
3. UTM report: [METRICS]
4. Risk assessment: [NOTES]

### Recommendation
Proceed to Phase [Y] on [DATE]

### Decision Required By
[DATE] to maintain momentum
```

---

## 9. Appendix: Quick Reference

### 9.1 Phase Timeline

| Phase | Duration | Key Milestone |
|---|---|---|
| Phase 1: Foundation | Weeks 1-2 | Account created, research complete |
| Phase 2: Karma Building | Weeks 3-6 | 50+ karma, 20+ comments |
| Phase 3: Soft Reveal | Weeks 7-10 | 200+ karma, first mentions |
| Phase 4: Community | Week 11+ | "I Built This" post, organic growth |

### 9.2 UTM Generator

```bash
# Quick UTM link generator
BASE="https://fenrir-ledger.dshanaghy.com/"
SOURCE="reddit"
MEDIUM="organic"
CAMPAIGN="soft-launch"

# Example for r/churning Daily Discussion
echo "${BASE}?utm_source=${SOURCE}&utm_medium=${MEDIUM}&utm_campaign=${CAMPAIGN}&utm_content=churning_dd"
```

### 9.3 Key Files

- Tracking log: `/workspace/designs/product/backlog/reddit-engagement-log.md`
- Subreddit profiles: `/workspace/designs/product/backlog/subreddit-profiles.md`
- Campaign plan: `/workspace/designs/product/backlog/marketing-campaign-plan.md`
- This document: `/workspace/designs/product/backlog/reddit-success-metrics.md`

---

*Document owner: Freya (Product Owner) | Ref: Issue #321*
*Review frequency: Weekly during campaign, monthly thereafter*