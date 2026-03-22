/**
 * Admin Console — /admin
 *
 * Default landing page for the admin console.
 * Renders the Pack Status Dashboard.
 *
 * Hidden route — no link anywhere on the public site.
 *
 * @see #654
 */

"use client";

import { PackStatusDashboard } from "@/components/admin/PackStatusDashboard";

export default function AdminPage() {
  return <PackStatusDashboard />;
}
