import type { Metadata } from "next";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "About",
};

export default function AboutPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-20 text-center">
      <p className="font-mono text-xs tracking-[0.3em] text-primary uppercase mb-4">ᛏ</p>
      <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-foreground mb-4">
        About
      </h1>
      <p className="font-body text-muted-foreground">Coming soon.</p>
    </div>
  );
}
