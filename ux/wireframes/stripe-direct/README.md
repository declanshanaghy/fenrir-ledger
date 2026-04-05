# Stripe Direct Wireframes

Stripe payment integration: settings, paywall modals, upsell banners, anonymous checkout, and Karl upsell dialogs.

| File | Issue | Description |
|------|-------|-------------|
| [stripe-settings.html](stripe-settings.html) | -- | StripeSettings component: 3 states (Thrall/Karl/Canceled), desktop + mobile, state machine, API flow |
| [sealed-rune-stripe.html](sealed-rune-stripe.html) | -- | Premium feature paywall modal with Stripe Checkout redirect, anonymous + authenticated flows |
| [upsell-banner-stripe.html](upsell-banner-stripe.html) | -- | Dashboard upgrade banner for Thrall users, Stripe Checkout CTA, dismiss lifecycle |
| [anonymous-checkout.html](anonymous-checkout.html) | -- | Email collection modal for anonymous Stripe subscribers, validation states, loading, mobile |
| [karl-upsell-dialog.html](karl-upsell-dialog.html) | #377 | Shared KarlUpsellDialog for all Karl-gated features: prop-driven feature icon/name/tagline/teaser, lock badge overlay, $3.99/mo price row, direct Stripe CTA; desktop + mobile bottom-sheet |
| [karl-upsell-dialog-artwork.html](karl-upsell-dialog-artwork.html) | #560 | Updated KarlUpsellDialog with featureImage prop: before/after Valhalla comparison, Howl + Smart Import variants, mobile 375px, full featureImage mapping table (all 9 Karl features) |
