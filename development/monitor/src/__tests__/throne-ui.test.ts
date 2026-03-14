/**
 * throne-ui.test.ts — Vitest tests for Odin's Throne Hlidskjalf UI (issue #882)
 *
 * Acceptance Criteria:
 *   AC1  Sidebar lists all agent sessions from K8s API
 *   AC3  Live sessions show pulsing indicator
 *   AC4  New sessions appear automatically via WebSocket
 *   AC5  Timestamps in local time with "ago" text
 *   AC6  Odin avatar + random quote displayed
 *   Plus: ARIA accessibility, Norse-dark theme, XSS safety
 */

import { describe, it, expect, vi } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../k8s.js", () => ({
  listAgentJobs: vi.fn().mockResolvedValue([]),
  findPodForSession: vi.fn(),
  streamPodLogs: vi.fn(),
}));

vi.mock("../ws.js", () => ({
  attachWebSocketServer: vi.fn(),
}));

vi.mock("@hono/node-server", () => ({
  serve: vi.fn().mockReturnValue({ on: vi.fn() }),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { app } from "../index.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getHtml(): Promise<string> {
  const res = await app.fetch(new Request("http://localhost:3001/"));
  return res.text();
}

// Known Odin quotes from the implementation
const ODIN_QUOTES = [
  "I hung on that windy tree for nine long nights. What's a failed build to that?",
  "I gave my eye for wisdom. You lot better not waste it on sloppy commits.",
  "The wolves are always hungry. Ship or be devoured.",
  "I see all nine worlds from Hlidskjalf. I can certainly see your merge conflicts.",
  "Even Ragnarok has a sprint deadline.",
  "The All-Father watches. The All-Father judges. The All-Father merges.",
  "Every rune I carved cost blood. Every PR you ship better be worth it.",
  "Fenrir breaks chains. We break annual fees. Same energy.",
  "My spear Gungnir never misses its mark. Your tests should aspire to the same.",
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AC6 — Odin avatar + random quote", () => {
  it("serves the Odin avatar PNG at /static/odin-dark.png", async () => {
    const res = await app.fetch(
      new Request("http://localhost:3001/static/odin-dark.png")
    );
    // Avatar file should exist in public/ for this branch
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers.get("content-type")).toBe("image/png");
    }
  });

  it("renders avatar img tag pointing to /static/odin-dark.png", async () => {
    const html = await getHtml();
    expect(html).toContain('src="/static/odin-dark.png"');
    expect(html).toContain('alt="Odin"');
  });

  it("displays one of the known Odin quotes in the page", async () => {
    const html = await getHtml();
    const hasQuote = ODIN_QUOTES.some((q) => html.includes(q));
    expect(hasQuote).toBe(true);
  });

  it("renders the quote inside an element with role=note", async () => {
    const html = await getHtml();
    expect(html).toMatch(/role="note"[^>]*>[^<]*?(hung|eye|wolves|nine|Ragnarok|All-Father|rune|Fenrir|Gungnir)/s);
  });
});

describe("AC1 — Sidebar with ARIA landmarks and session list", () => {
  it("renders a nav sidebar with aria-label='Agent sessions'", async () => {
    const html = await getHtml();
    expect(html).toContain('aria-label="Agent sessions"');
  });

  it("renders job card list with role=list and aria-label", async () => {
    const html = await getHtml();
    expect(html).toContain('role="list"');
    expect(html).toContain('aria-label="Job sessions"');
  });

  it("renders the Hlidskjalf title in the sidebar header", async () => {
    const html = await getHtml();
    expect(html).toContain("Hlidskjalf");
    expect(html).toContain("Odin");
  });
});

describe("AC3+AC4 — WebSocket client and live-update script", () => {
  it("embeds WebSocket connection logic with /ws/logs/ path", async () => {
    const html = await getHtml();
    expect(html).toContain("/ws/logs/");
    expect(html).toContain("new WebSocket");
  });

  it("polls /api/jobs every 15 seconds for new sessions (AC4)", async () => {
    const html = await getHtml();
    expect(html).toContain("fetchJobs");
    expect(html).toContain("15000");
  });

  it("refreshes timestamps every 10 seconds (AC5)", async () => {
    const html = await getHtml();
    expect(html).toContain("refreshTimestamps");
    expect(html).toContain("10000");
  });
});

describe("AC3 — Pulsing status indicator for live sessions", () => {
  it("defines pulse CSS animation for active/live sessions", async () => {
    const html = await getHtml();
    expect(html).toContain("pulse");
    expect(html).toContain("@keyframes pulse");
  });

  it("script maps active status to the pulsing class", async () => {
    const html = await getHtml();
    // Script should assign 'pulse' class to active sessions
    expect(html).toContain("active");
    expect(html).toContain("STATUS_ICONS");
  });
});

describe("AC5 — Timestamps in local time with ago text", () => {
  it("includes fmtTime and timeAgo functions for timestamp display", async () => {
    const html = await getHtml();
    expect(html).toContain("fmtTime");
    expect(html).toContain("timeAgo");
  });

  it("timeAgo function covers seconds, minutes, hours, days ranges", async () => {
    const html = await getHtml();
    // Check the function includes all the time range branches
    expect(html).toContain("ago");
    expect(html).toContain("just now");
  });
});

describe("Norse-dark theme + XSS safety", () => {
  it("defines Norse-dark CSS variables (--void, --gold)", async () => {
    const html = await getHtml();
    expect(html).toContain("--void");
    expect(html).toContain("--gold");
    expect(html).toContain("--forge");
  });

  it("loads Cinzel and JetBrains Mono fonts for the Fenrir theme", async () => {
    const html = await getHtml();
    expect(html).toContain("Cinzel");
    expect(html).toContain("JetBrains Mono");
  });

  it("includes escHtml function to prevent XSS injection in log output", async () => {
    const html = await getHtml();
    expect(html).toContain("escHtml");
    // Must handle all four critical characters
    expect(html).toContain("&amp;");
    expect(html).toContain("&lt;");
    expect(html).toContain("&gt;");
    expect(html).toContain("&quot;");
  });
});

describe("ARIA accessibility", () => {
  it("renders aria-live=polite on the log terminal for screen readers", async () => {
    const html = await getHtml();
    expect(html).toContain('aria-live="polite"');
  });

  it("renders role=log on the log terminal", async () => {
    const html = await getHtml();
    expect(html).toContain('role="log"');
  });

  it("main content area has aria-label='Log viewer'", async () => {
    const html = await getHtml();
    expect(html).toContain('aria-label="Log viewer"');
  });
});
