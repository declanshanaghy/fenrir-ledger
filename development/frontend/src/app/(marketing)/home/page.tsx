/**
 * /home — redirects to / (marketing home moved to root in Issue #371).
 */

import { redirect } from "next/navigation";

export default function HomeRedirectPage() {
  redirect("/");
}
