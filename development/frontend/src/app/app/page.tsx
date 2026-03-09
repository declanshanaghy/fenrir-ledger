/**
 * /app route — redirects to the main dashboard at /ledger.
 *
 * Marketing site CTAs link to /app. This page redirects to /ledger where the
 * authenticated app dashboard lives.
 */

import { redirect } from "next/navigation";

export default function AppRedirectPage() {
  redirect("/ledger");
}
