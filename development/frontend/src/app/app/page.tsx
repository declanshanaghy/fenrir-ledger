/**
 * /app route — redirects to the main dashboard at /.
 *
 * Marketing site CTAs link to /app. This page redirects to / where the
 * authenticated app dashboard lives.
 */

import { redirect } from "next/navigation";

export default function AppRedirectPage() {
  redirect("/");
}
