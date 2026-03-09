/**
 * /home route — redirects to / where the marketing home page now lives.
 *
 * Route restructure (Issue #371): marketing home moved from /home to /.
 */

import { redirect } from "next/navigation";

export default function HomeRedirectPage() {
  redirect("/");
}
