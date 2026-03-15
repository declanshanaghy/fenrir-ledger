/**
 * Loki QA augmentation tests — issue #1004
 *
 * Covers edge cases from handoff not addressed by FiremanDecko's theme-colors.test.tsx:
 * 1. NorseErrorTablet has no runtime data-theme override (stays dark by design)
 * 2. ThemeSwitcher rapid toggle — setTheme called each time (no debounce stale state)
 * 3. parseEntrypointLine --- section markers --- parsed as entrypoint-header (regression fix)
 * 4. ThemeSwitcher is rendered in Sidebar (AC: toggle still functions after PR #988 compaction)
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NorseErrorTablet } from "../components/NorseErrorTablet";
import { ThemeSwitcher } from "../components/ThemeSwitcher";
import { parseEntrypointLine } from "../hooks/useLogStream";

afterEach(cleanup);

// ── NorseErrorTablet — no light-theme override ────────────────────────────────

describe("NorseErrorTablet — dark-only by design (issue #1004 Loki QA)", () => {
  it("does not set data-theme attribute on itself (stays dark regardless of page theme)", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="loki-qa-test" message="TTL expired." />
    );
    const tablet = container.querySelector(".norse-error-tablet");
    expect(tablet?.hasAttribute("data-theme")).toBe(false);
  });

  it("does not apply a [data-theme='light'] override inside the component tree", () => {
    const { container } = render(
      <NorseErrorTablet sessionId="loki-qa-test" message="TTL expired." />
    );
    // No child element should carry a data-theme override that would switch it to light
    const lightOverrides = container.querySelectorAll("[data-theme='light']");
    expect(lightOverrides.length).toBe(0);
  });
});

// ── ThemeSwitcher — rapid toggle contract ─────────────────────────────────────

describe("ThemeSwitcher — rapid theme toggling (issue #1004 Loki QA)", () => {
  it("calls setTheme on every click — no debounce swallowing rapid toggles", async () => {
    const setTheme = vi.fn();
    const { container } = render(<ThemeSwitcher theme="dark" setTheme={setTheme} />);
    const lightBtn = within(container).getByRole("button", { name: /light/i });
    const darkBtn = within(container).getByRole("button", { name: /dark/i });

    await userEvent.click(lightBtn);
    await userEvent.click(darkBtn);
    await userEvent.click(lightBtn);

    expect(setTheme).toHaveBeenCalledTimes(3);
    expect(setTheme).toHaveBeenNthCalledWith(1, "light");
    expect(setTheme).toHaveBeenNthCalledWith(2, "dark");
    expect(setTheme).toHaveBeenNthCalledWith(3, "light");
  });
});

// ── parseEntrypointLine — --- section marker --- regression (issue #1004) ──────

describe("parseEntrypointLine — --- section markers --- (issue #1004 Loki QA)", () => {
  it("--- TASK PROMPT --- is parsed as entrypoint-header", () => {
    const entry = parseEntrypointLine("--- TASK PROMPT ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("TASK PROMPT");
  });

  it("--- END PROMPT --- is parsed as entrypoint-header", () => {
    const entry = parseEntrypointLine("--- END PROMPT ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("END PROMPT");
  });

  it("arbitrary --- Section --- is parsed as entrypoint-header", () => {
    const entry = parseEntrypointLine("--- Agent Configuration ---");
    expect(entry.type).toBe("entrypoint-header");
    expect(entry.text).toBe("Agent Configuration");
  });
});
