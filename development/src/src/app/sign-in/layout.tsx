/**
 * /sign-in route segment layout — server component.
 *
 * Sets the page <title> for the Sign In route.
 * Title follows the format established in product/copywriting.md.
 *
 * A separate layout.tsx is required because the page itself is a client
 * component ("use client") and cannot export Next.js metadata directly.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
