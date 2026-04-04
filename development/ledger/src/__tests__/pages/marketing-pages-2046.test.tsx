/**
 * Smoke-render tests for marketing pages:
 *   - src/app/(marketing)/page.tsx — Home page
 *   - src/app/(marketing)/pricing/page.tsx — Pricing page
 *   - src/app/(marketing)/free-trial/FreeTrialContent.tsx — Free trial client component
 *   - src/app/(marketing)/about/page.tsx — About page
 *
 * These pages are primarily static layout/content. Tests verify that each
 * page renders key structural landmarks without asserting on static copy.
 *
 * Issue: #2046
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// ── Shared infrastructure mocks ───────────────────────────────────────────────

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt: string; [k: string]: unknown }) =>
    React.createElement("img", { alt, ...props }),
}));

const MOTION_SKIP_PROPS = new Set([
  "variants", "initial", "animate", "exit", "transition",
  "whileInView", "viewport", "custom", "whileHover", "whileTap",
]);

function makePassthrough(tag: string) {
  return React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & Record<string, unknown>>(
    ({ children, className, style, ...rest }, ref) => {
      const filteredProps: Record<string, unknown> = {};
      if (ref) filteredProps.ref = ref;
      if (className) filteredProps.className = className;
      if (style) filteredProps.style = style;
      for (const [k, v] of Object.entries(rest)) {
        if (!MOTION_SKIP_PROPS.has(k)) filteredProps[k] = v;
      }
      return React.createElement(tag, filteredProps, children);
    }
  );
}

vi.mock("framer-motion", () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) => makePassthrough(tag),
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useReducedMotion: () => true,
  useInView: () => true,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "dark", setTheme: vi.fn() }),
}));

vi.mock("@/components/marketing/DataSafetyBanner", () => ({
  DataSafetyBanner: () => React.createElement("div", { "data-testid": "data-safety-banner" }),
}));

vi.mock("@/components/marketing/PricingFaqAccordion", () => ({
  PricingFaqAccordion: () => React.createElement("div", { "data-testid": "pricing-faq" }),
}));

// PricingFaqAccordion is a relative import in pricing/page.tsx
vi.mock(
  "/workspace/repo/development/ledger/src/app/(marketing)/pricing/PricingFaqAccordion",
  () => ({
    PricingFaqAccordion: () => React.createElement("div", { "data-testid": "pricing-faq" }),
  })
);

// ── Home page ────────────────────────────────────────────────────────────────

describe("Marketing Home Page", () => {
  it("renders without crashing and includes landmark sections", async () => {
    const { default: MarketingHomePage } = await import(
      "@/app/(marketing)/page"
    );
    render(React.createElement(MarketingHomePage));
    // Hero section landmark
    expect(screen.getByRole("region", { name: /hero/i })).toBeInTheDocument();
    // CTA link
    expect(screen.getByRole("link", { name: /break the chain/i })).toBeInTheDocument();
  });
});

// ── Pricing page ─────────────────────────────────────────────────────────────

describe("Pricing Page", () => {
  it("renders without crashing and shows tier cards", async () => {
    const { default: PricingPage } = await import(
      "@/app/(marketing)/pricing/page"
    );
    render(React.createElement(PricingPage));
    // Two pricing tiers
    expect(screen.getByRole("heading", { name: /thrall/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /karl/i })).toBeInTheDocument();
  });
});

// ── FreeTrialContent ─────────────────────────────────────────────────────────

describe("FreeTrialContent", () => {
  it("renders without crashing and shows main CTA", async () => {
    const { FreeTrialContent } = await import(
      "@/app/(marketing)/free-trial/FreeTrialContent"
    );
    render(React.createElement(FreeTrialContent));
    // Primary sign-in CTA links (role="button" is set on the Link, query by role button)
    const ctaBtns = screen.getAllByRole("button", { name: /sign in with google to start/i });
    expect(ctaBtns.length).toBeGreaterThan(0);
  });

  it("renders feature showcase section", async () => {
    const { FreeTrialContent } = await import(
      "@/app/(marketing)/free-trial/FreeTrialContent"
    );
    render(React.createElement(FreeTrialContent));
    expect(screen.getByRole("list", { name: /trial features/i })).toBeInTheDocument();
  });
});

// ── About page ───────────────────────────────────────────────────────────────

describe("About Page", () => {
  it("renders without crashing", async () => {
    const { default: AboutPage } = await import(
      "@/app/(marketing)/about/page"
    );
    const { container } = render(React.createElement(AboutPage));
    expect(container.firstChild).not.toBeNull();
  });
});
