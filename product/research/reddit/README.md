# Reddit Research

Subreddit-level research, engagement profiles, and draft comments for Fenrir Ledger's Reddit campaign.

## Subreddit Profiles

- [r/churning](./churning/profile.md) — ⛔ Dropped (too hostile to promotion)
- [r/creditcards](./creditcards/profile.md)

## Reddit RSS Feeds

Reddit exposes RSS for almost any page by appending `.rss` to the URL. Useful for monitoring via Inoreader, Feeder, n8n RSS nodes, etc.

### Feed formats

| Target | URL pattern |
|---|---|
| Subreddit (hot) | `https://www.reddit.com/r/<sub>/.rss` |
| New posts | `https://www.reddit.com/r/<sub>/new.rss` |
| Top posts | `https://www.reddit.com/r/<sub>/top.rss` |
| User profile | `https://www.reddit.com/user/<username>/.rss` |
| Combined subs | `https://www.reddit.com/r/<subA>+<subB>.rss` |
| Post comments | append `.rss` to the post URL |

### Our target subs

- https://www.reddit.com/r/churning/new.rss
- https://www.reddit.com/r/creditcards/new.rss
- https://www.reddit.com/r/awardtravel/new.rss
- Combined: https://www.reddit.com/r/churning+creditcards+awardtravel/new.rss

### Gotchas

- **User-Agent required.** Reddit rejects the default `curl` UA with 429. Always send a descriptive custom UA (e.g. `fenrir-ledger-rss/1.0`).
- **Rate limits.** Anonymous RSS is aggressively throttled — poll no more than once every few minutes per feed and back off on 429.
- **WebFetch is blocked** for `reddit.com` in Claude Code; use `curl` or an n8n HTTP Request / RSS Feed Read node instead.
- **r/CreditCardChurning does NOT exist** — despite the name looking plausible, Reddit returns a 302 redirect to subreddit search for this URL. Verified 2026-04-08 via `curl /api/info.json?sr_name=CreditCardChurning` (empty listing) and `/subreddits/search.json?q=CreditCardChurning` (no match). The only real "churning" subs are **r/churning** (general, AVOID-level), **r/creditcardchurningAus** (Australian-only), and **r/churningcanada** (Canadian-only). Historical profile at `product/research/reddit/CreditCardChurning/` was deleted in the same cleanup.

### Source

Format reference: NewsBlur — "How to Create Reddit RSS Feeds".
