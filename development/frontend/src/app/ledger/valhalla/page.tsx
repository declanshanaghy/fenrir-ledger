/**
 * /ledger/valhalla — Removed in Issue #377.
 *
 * Valhalla is now a Karl-gated tab on the main dashboard. The standalone
 * route no longer exists. Visiting /ledger/valhalla returns a 404.
 */

import { notFound } from "next/navigation";

export default function ValhallaPage() {
  notFound();
}
