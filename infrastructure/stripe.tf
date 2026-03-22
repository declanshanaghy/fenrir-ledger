# --------------------------------------------------------------------------
# Stripe — Webhook Endpoint
#
# Manages the Stripe webhook endpoint in IaC so the URL is never configured
# manually in the Stripe Dashboard (which previously caused 301 redirect
# failures because the non-www domain was used).
#
# Provider: lukasaron/stripe (~> 1.9)
# Docs:     https://registry.terraform.io/providers/lukasaron/stripe/latest/docs/resources/webhook_endpoint
# --------------------------------------------------------------------------

resource "stripe_webhook_endpoint" "main" {
  url = "https://www.fenrirledger.com/api/stripe/webhook"

  enabled_events = [
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "billing_portal.session.created",
  ]

  description = "Fenrir Ledger production webhook — managed by Terraform"
}
