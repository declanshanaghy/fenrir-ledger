/**
 * /ledger/valhalla — Removed in Issue #377.
 *
 * Valhalla is now a Karl-gated tab on the main dashboard. The standalone
 * route is deprecated. Visiting /ledger/valhalla redirects to /ledger.
 */

import { redirect } from "next/navigation";

export default function ValhallaPage() {
  redirect("/ledger?tab=valhalla");
}
