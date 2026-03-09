/**
 * /ledger/valhalla — Removed in Issue #352.
 *
 * The standalone Valhalla route has been replaced by the Valhalla tab on the
 * main dashboard. Visiting /ledger/valhalla redirects to /ledger?tab=valhalla.
 */

import { redirect } from "next/navigation";

export default function ValhallaPage() {
  redirect("/ledger?tab=valhalla");
}
