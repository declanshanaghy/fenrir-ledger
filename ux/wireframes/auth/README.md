# Auth Wireframes

Authentication flows: sign-in, migration, upsell, and multi-IdP support.

| File | Issue | Description |
|------|-------|-------------|
| [sign-in.html](sign-in.html) | -- | Dedicated /sign-in page (not gated — optional upgrade); no-data and has-data variants; desktop + mobile; "Continue without signing in" is a first-class prominent CTA |
| [multi-idp-sign-in.html](multi-idp-sign-in.html) | -- | Planned: modal dialog supporting 1-4+ providers; desktop centered + mobile bottom-anchored; "Continue without signing in" sole prominent dismiss |
| [migration-prompt.html](migration-prompt.html) | -- | Post-OAuth modal dialog: Import N cards vs. Start fresh; reassurance copy; desktop + mobile stacked choices; state flow diagram |
| [upsell-banner.html](upsell-banner.html) | -- | Dismissible banner below TopBar on the dashboard: visible/dismissed/signed-in variants, desktop + mobile; dismiss lifecycle and localStorage flag spec |
