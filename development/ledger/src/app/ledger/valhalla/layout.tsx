/**
 * /valhalla layout — Issue #352: route removed, redirects to /?tab=valhalla.
 */

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Valhalla",
};

export default function ValhallaLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
