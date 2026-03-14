# Subscription Platform Research for Fenrir Ledger

## Context

Fenrir Ledger is a freemium credit card churning tool built on Next.js/GKE Autopilot. Free tier uses browser localStorage; paid tier adds cloud sync via Google OAuth. Target audience: credit card churners managing 5-20+ active cards. Expected price point: $3-10/month.

## Decision Outcome

**Stripe Direct is the subscription platform** (March 2026). Patreon was initially selected and integrated, then fully removed in favor of Stripe Direct for better revenue retention, full billing control, and churner-friendly payment methods. See [platform-recommendation.md](platform-recommendation.md) for the full rationale and implementation strategy.






---

## Platform Comparison

### 1. Substack — Best for Audience Discovery

- **Fees**: 10% of paid subscription revenue + Stripe processing (2.9% + $0.30)
- **Payment methods**: Credit cards via Stripe
- **Tiered subscriptions**: Free + one paid tier
- **Community features**: Comments, discussion threads, Notes (social feed), chat
- **Established**: Very well established; millions of subscribers
- **Churning relevance**: **HIGH** — Multiple active credit card churning newsletters already exist on Substack (Raymond La, The Daily Churn, Datastream, Exclusive Access). Churners are already reading and paying for content here.
- **Pros**: Built-in discovery/network effects; readers already on platform; excellent email delivery; SEO-friendly; no upfront cost
- **Cons**: 10% fee is relatively high; limited tier customization; less suited for tools/software delivery

### 2. Buy Me a Coffee — Simplest, Lowest Friction

- **Fees**: 5% flat on all earnings + payment processing (~2.9% + $0.30)
- **Payment methods**: Credit cards, PayPal, Apple Pay, Google Pay, UPI
- **Tiered subscriptions**: Yes, monthly and annual membership plans
- **Community features**: Posts, exclusive content for members, extras/shop
- **Established**: Well established, 2M+ creators
- **Churning relevance**: LOW — No organic churning community presence. More associated with casual creator tipping.
- **Pros**: Low fees; simple setup; all features free; broad payment methods
- **Cons**: Brand perception is casual/tip-based; limited community features; no built-in audience discovery

### 3. Patreon — Best Tier Management [REMOVED -- replaced by Stripe Direct]

- **Fees**: 10% for new creators (as of August 2025) + payment processing (2.9% + $0.30) + 30% Apple tax on iOS
- **Payment methods**: Credit cards, PayPal
- **Tiered subscriptions**: Yes, robust multi-tier system with per-tier benefits
- **Community features**: Posts, polls, community tab, Discord integration, messaging
- **Established**: The most well-known creator membership platform
- **Churning relevance**: LOW-MEDIUM — Not a natural home for fintech content, but the tiered model is excellent for differentiated access levels
- **Pros**: Strong brand recognition; excellent tier management; good analytics; Discord integration
- **Cons**: Fees increasing (10% for new creators); iOS Apple tax is brutal (30%); not where churners naturally congregate

### 4. Ghost — Best Revenue Retention

- **Fees**: **0% platform fee** on revenue; hosting $15-29/month (Ghost Pro); Stripe processing applies
- **Payment methods**: Credit cards via Stripe
- **Tiered subscriptions**: Yes, multiple paid tiers with gated content
- **Community features**: Built-in email newsletters, member portal, comments
- **Established**: Well established as a publishing platform
- **Churning relevance**: MEDIUM — Newsletter/blog format suits deal alerts and strategy content. No existing churning community, but professional presentation and 0% take rate are attractive.
- **Pros**: 0% revenue share (you only pay hosting + Stripe); full ownership of content and audience; SEO-optimized; professional appearance; custom domain
- **Cons**: Monthly hosting cost regardless of revenue; more technical setup; no built-in audience discovery

### 5. Ko-fi — Cheapest Option

- **Fees**: 0% on donations (free plan); 5% on memberships/shop (free plan); $12/month for Ko-fi Gold (0% platform fee)
- **Payment methods**: Credit cards via Stripe, PayPal
- **Tiered subscriptions**: Yes, membership tiers with monthly pricing
- **Community features**: Posts, galleries, exclusive content, Discord integration
- **Established**: Well established, growing
- **Churning relevance**: LOW — No churning community presence. Oriented toward artists/creators.
- **Pros**: Lowest fees (especially with Gold); instant payouts; no lock-in
- **Cons**: Smaller audience/discovery; brand associated with art/creative community; less professional appearance

### 6. Gumroad — Digital Product Focused

- **Fees**: 10% + $0.50 per transaction + payment processing (2.9% + $0.30)
- **Payment methods**: Credit cards, PayPal
- **Tiered subscriptions**: Yes, supports recurring memberships
- **Community features**: Minimal — primarily a storefront
- **Established**: Well established for digital product sales
- **Churning relevance**: LOW — Better suited for one-time digital product sales than ongoing subscriptions.
- **Pros**: No monthly fees; handles sales tax globally (since Jan 2025)
- **Cons**: High effective fee rate (10% + $0.50 + processing); weak community features; "Discover" marketplace takes 30%+

### 7. Memberful — WordPress/Discord Integration

- **Fees**: $49/month + 4.9% per transaction + Stripe processing (2.9% + $0.30)
- **Payment methods**: Credit cards via Stripe, Apple Pay, Google Pay
- **Tiered subscriptions**: Highly customizable (monthly, yearly, quarterly, custom intervals)
- **Community features**: Integrates with Discord, WordPress, podcasts
- **Established**: Well established, owned by Patreon
- **Churning relevance**: LOW-MEDIUM — Good infrastructure for custom membership on your own site/Discord
- **Pros**: Deep integrations; Apple/Google Pay; group subscriptions; you own the relationship
- **Cons**: Expensive ($49/month + 4.9%); requires your own website/platform; no content hosting or discovery

### 8. Stripe Direct — Best for SaaS/Tool Delivery **[SELECTED -- IMPLEMENTED]**

- **Fees**: 2.9% + $0.30 per card transaction + 0.7% for Stripe Billing
- **Payment methods**: All major credit cards, Apple Pay, Google Pay, ACH, and many more
- **Tiered subscriptions**: Fully customizable via Stripe Billing
- **Community features**: None — pure payment infrastructure
- **Established**: Industry-standard payment processor
- **Churning relevance**: MEDIUM — Maximum flexibility; lowest total fees. Churners appreciate direct credit card payments (maximizes their own rewards).
- **Pros**: Lowest fees overall (~3.6% total); full control; all payment methods; customer portal; invoicing
- **Cons**: Requires significant development work; no content hosting, community, or discovery

---

## Fee Comparison (per $10/month subscription)

| Platform | Platform Fee | Processing Fee | Monthly Cost | You Keep (per $10) |
|---|---|---|---|---|
| Ghost | 0% | ~$0.59 | $15-29/mo hosting | ~$9.41 |
| Stripe Direct | $0.07 (0.7%) | ~$0.59 | $0 | ~$9.34 |
| Ko-fi Gold | 0% | ~$0.59 | $12/mo | ~$9.41 |
| Buy Me a Coffee | $0.50 (5%) | ~$0.59 | $0 | ~$8.91 |
| Ko-fi Free | $0.50 (5%) | ~$0.59 | $0 | ~$8.91 |
| Patreon (new) | $1.00 (10%) | ~$0.59 | $0 | ~$8.41 |
| Substack | $1.00 (10%) | ~$0.59 | $0 | ~$8.41 |
| Gumroad | $1.50 (10%+$0.50) | ~$0.59 | $0 | ~$7.91 |
| Memberful | $0.49 (4.9%) | ~$0.59 | $49/mo | ~$8.92 (minus $49 amortized) |

**Note:** Stripe Direct was selected for its lowest effective fees (~$9.34 kept per $10 subscription), full control over the billing experience, and churner-friendly payment methods. Patreon was initially implemented but fully removed in favor of Stripe Direct. See [platform-recommendation.md](platform-recommendation.md) for the full cost-benefit analysis.
