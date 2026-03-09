/**
 * /valhalla — Removed in Issue #352.
 *
 * The standalone Valhalla route has been replaced by the Valhalla tab on the
 * main dashboard. Visiting /valhalla redirects to /?tab=valhalla.
 */

import { redirect } from "next/navigation";

export default function ValhallaPage() {
  redirect("/?tab=valhalla");
}
