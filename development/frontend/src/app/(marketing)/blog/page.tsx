import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog",
};

export default function BlogPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-20 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-4">ᛉ</p>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-foreground mb-4">
        Session Chronicles
      </h1>
      <p className="font-body text-muted-foreground">Coming soon.</p>
    </div>
  );
}
