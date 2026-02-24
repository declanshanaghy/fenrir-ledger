/**
 * EmptyState — displayed on the dashboard when no cards exist.
 */

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-6xl mb-4" aria-hidden="true">
        🐺
      </div>
      <h2 className="text-2xl font-semibold mb-2">No cards yet</h2>
      <p className="text-muted-foreground mb-6 max-w-md">
        Add your first credit card to start tracking fees, rewards, and deadlines.
        Fenrir watches so nothing slips through.
      </p>
      <Button asChild>
        <Link href="/cards/new">Add your first card</Link>
      </Button>
    </div>
  );
}
