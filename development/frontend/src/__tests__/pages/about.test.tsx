/**
 * About Page — Component render tests
 *
 * Validates the redesigned About page (Issue #633):
 *   - Dual-realm agent profiles with alternating layout
 *   - Portrait crossfade driven by theme
 *   - Realm badges and lore text switch with theme
 *   - All 5 agents rendered with correct aria-labels
 *   - Hover overlay class mapping
 *   - Section landmarks present
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Theme mock state ────────────────────────────────────────────────────────

let mockResolvedTheme = "light";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockResolvedTheme,
    resolvedTheme: mockResolvedTheme,
    setTheme: vi.fn(),
  }),
}));

vi.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    style,
    className,
    ...props
  }: {
    src: string;
    alt: string;
    style?: Record<string, unknown>;
    className?: string;
    [key: string]: unknown;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} style={style} className={className} {...props} />
  ),
}));

// Mock framer-motion to render static elements
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target, prop: string) => {
        // Return a component that renders the HTML element with all props
        const MotionComponent = ({
          children,
          variants: _variants,
          initial: _initial,
          animate: _animate,
          whileHover: _whileHover,
          ...rest
        }: Record<string, unknown> & { children?: React.ReactNode }) => {
          const Tag = prop as keyof JSX.IntrinsicElements;
          return <Tag {...(rest as Record<string, string>)}>{children}</Tag>;
        };
        MotionComponent.displayName = `motion.${prop}`;
        return MotionComponent;
      },
    },
  ),
  useInView: () => true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));

import AboutPage from "@/app/(marketing)/about/page";

// ── Tests ───────────────────────────────────────────────────────────────────

describe("About Page — Section Landmarks", () => {
  beforeEach(() => {
    mockResolvedTheme = "light";
  });

  it("renders Origin story section", () => {
    render(<AboutPage />);
    const section = screen.getByLabelText("Origin story");
    expect(section).toBeDefined();
  });

  it("renders The founding myth section", () => {
    render(<AboutPage />);
    const section = screen.getByLabelText("The founding myth");
    expect(section).toBeDefined();
  });

  it("renders The agents of Asgard section", () => {
    render(<AboutPage />);
    const section = screen.getByLabelText("The agents of Asgard");
    expect(section).toBeDefined();
  });

  it("renders The Forge section", () => {
    render(<AboutPage />);
    const section = screen.getByLabelText("The Forge");
    expect(section).toBeDefined();
  });

  it("renders Call to action section", () => {
    render(<AboutPage />);
    const section = screen.getByLabelText("Call to action");
    expect(section).toBeDefined();
  });
});

describe("About Page — Agent Myth Rows (#633)", () => {
  beforeEach(() => {
    mockResolvedTheme = "light";
  });

  it("renders all 5 agent articles with correct aria-labels", () => {
    render(<AboutPage />);
    const agents = [
      "Freya \u2014 Product Owner",
      "Luna \u2014 UX Designer",
      "FiremanDecko \u2014 Principal Engineer",
      "Loki \u2014 QA Tester",
      "Heimdall \u2014 Security Guardian",
    ];
    for (const label of agents) {
      const article = screen.getByLabelText(label);
      expect(article).toBeDefined();
      expect(article.tagName.toLowerCase()).toBe("article");
    }
  });

  it("renders dual portraits (light + dark) for each agent", () => {
    render(<AboutPage />);
    // Check Freya has both light and dark portrait images
    const lightPortrait = screen.getByAltText("Freya \u2014 light realm portrait");
    const darkPortrait = screen.getByAltText("Freya \u2014 dark realm portrait");
    expect(lightPortrait).toBeDefined();
    expect(darkPortrait).toBeDefined();
  });

  it("shows light portrait opaque in light theme", () => {
    mockResolvedTheme = "light";
    render(<AboutPage />);
    const lightPortrait = screen.getByAltText("Freya \u2014 light realm portrait") as HTMLImageElement;
    const darkPortrait = screen.getByAltText("Freya \u2014 dark realm portrait") as HTMLImageElement;
    expect(lightPortrait.style.opacity).toBe("1");
    expect(darkPortrait.style.opacity).toBe("0");
  });

  it("shows dark portrait opaque in dark theme", () => {
    mockResolvedTheme = "dark";
    render(<AboutPage />);
    const lightPortrait = screen.getByAltText("Freya \u2014 light realm portrait") as HTMLImageElement;
    const darkPortrait = screen.getByAltText("Freya \u2014 dark realm portrait") as HTMLImageElement;
    expect(lightPortrait.style.opacity).toBe("0");
    expect(darkPortrait.style.opacity).toBe("1");
  });

  it("renders agent names as h3 headings", () => {
    render(<AboutPage />);
    const headings = screen.getAllByRole("heading", { level: 3 });
    const names = headings.map((h) => h.textContent);
    expect(names).toContain("Freya");
    expect(names).toContain("Luna");
    expect(names).toContain("FiremanDecko");
    expect(names).toContain("Loki");
    expect(names).toContain("Heimdall");
  });

  it("renders realm badge with aria-live='polite'", () => {
    render(<AboutPage />);
    const badges = document.querySelectorAll("[aria-live='polite']");
    // Each agent gets a realm badge — 5 agents
    expect(badges.length).toBe(5);
  });

  it("renders light realm lore visible in light theme", () => {
    mockResolvedTheme = "light";
    render(<AboutPage />);
    // Light lore should not be aria-hidden
    const lightLoreElements = document.querySelectorAll("[aria-hidden='false']");
    expect(lightLoreElements.length).toBeGreaterThan(0);
  });
});

describe("About Page — Hover Overlay Effects (#633)", () => {
  beforeEach(() => {
    mockResolvedTheme = "light";
  });

  it("renders scan hover overlay for Heimdall", () => {
    render(<AboutPage />);
    const scanOverlay = document.querySelector(".about-hover-scan");
    expect(scanOverlay).not.toBeNull();
  });

  it("renders glow hover overlay for Freya", () => {
    render(<AboutPage />);
    const glowOverlay = document.querySelector(".about-hover-glow");
    expect(glowOverlay).not.toBeNull();
  });

  it("renders shimmer hover overlay for Luna", () => {
    render(<AboutPage />);
    const shimmerOverlay = document.querySelector(".about-hover-shimmer");
    expect(shimmerOverlay).not.toBeNull();
  });

  it("renders fire hover overlay for FiremanDecko", () => {
    render(<AboutPage />);
    const fireOverlay = document.querySelector(".about-hover-fire");
    expect(fireOverlay).not.toBeNull();
  });

  it("renders glitch hover overlay for Loki", () => {
    render(<AboutPage />);
    const glitchOverlay = document.querySelector(".about-hover-glitch");
    expect(glitchOverlay).not.toBeNull();
  });

  it("all hover overlays have aria-hidden='true'", () => {
    render(<AboutPage />);
    const overlays = [
      ".about-hover-glow",
      ".about-hover-shimmer",
      ".about-hover-fire",
      ".about-hover-glitch",
      ".about-hover-scan",
    ];
    for (const selector of overlays) {
      const el = document.querySelector(selector);
      expect(el?.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

describe("About Page — Alternating Layout (#633)", () => {
  beforeEach(() => {
    mockResolvedTheme = "light";
  });

  it("even-index agents have flex-row, odd-index have flex-row-reverse", () => {
    render(<AboutPage />);
    const agents = [
      "Freya \u2014 Product Owner",
      "Luna \u2014 UX Designer",
      "FiremanDecko \u2014 Principal Engineer",
      "Loki \u2014 QA Tester",
      "Heimdall \u2014 Security Guardian",
    ];
    for (let i = 0; i < agents.length; i++) {
      const article = screen.getByLabelText(agents[i]);
      const classes = article.className;
      if (i % 2 === 0) {
        expect(classes).toContain("flex-row");
        expect(classes).not.toContain("flex-row-reverse");
      } else {
        expect(classes).toContain("flex-row-reverse");
      }
    }
  });
});
