/**
 * /cards/[id]/edit route segment layout — server component.
 *
 * Sets the page <title> for the Edit Card route.
 * Per product/copywriting.md /cards/[id] heading: "[Card Name] — card record"
 * Static fallback title is used here; dynamic card name would require
 * generateMetadata + server data fetch which is out of scope for this sprint.
 *
 * A separate layout.tsx is required because the page itself is a client
 * component ("use client") and cannot export Next.js metadata directly.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Edit Card",
};

export default function EditCardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
