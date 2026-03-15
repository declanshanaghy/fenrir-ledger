/**
 * QA tests for Issue #1005 — Odin light profile image sync to monitor-ui
 *
 * Validates:
 * 1. Both odin-light.png files (canonical + monitor-ui public) are ~1.7MB (not stale 16KB)
 * 2. Sidebar renders /odin-light.png src when theme is "light"
 * 3. Sidebar renders /odin-dark.png src when theme is "dark"
 * 4. Dark theme image is unaffected by the sync
 */
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { statSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Sidebar } from "../components/Sidebar";
import type { DisplayJob } from "../lib/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths relative to this test file (development/monitor-ui/src/__tests__/)
// __dirname = .../development/monitor-ui/src/__tests__
// ../../public = .../development/monitor-ui/public  ✓
// ../../../.. = repo root → ../../../../.claude/agents/profiles ✓
const MONITOR_UI_PUBLIC = resolve(__dirname, "../../public");
const CANONICAL_PROFILES = resolve(__dirname, "../../../../.claude/agents/profiles");

const STALE_SIZE_BYTES = 16 * 1024; // 16KB — the stale version size
const MIN_EXPECTED_BYTES = 1 * 1024 * 1024; // 1MB minimum — valid updated image

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

const makeJob = (id: string): DisplayJob => ({
  sessionId: id,
  name: `job-${id}`,
  issue: "123",
  step: "1",
  agentKey: "loki",
  agentName: "Loki",
  status: "running",
  startTime: Date.now(),
  completionTime: null,
});

// ── File size verification ────────────────────────────────────────────────────

describe("odin-light.png file size (issue #1005)", () => {
  it("canonical profile image is ~1.7MB (not the stale 16KB version)", () => {
    const { size } = statSync(`${CANONICAL_PROFILES}/odin-light.png`);
    expect(size).toBeGreaterThan(MIN_EXPECTED_BYTES);
    expect(size).not.toBeLessThanOrEqual(STALE_SIZE_BYTES);
  });

  it("monitor-ui public image is ~1.7MB (not the stale 16KB version)", () => {
    const { size } = statSync(`${MONITOR_UI_PUBLIC}/odin-light.png`);
    expect(size).toBeGreaterThan(MIN_EXPECTED_BYTES);
    expect(size).not.toBeLessThanOrEqual(STALE_SIZE_BYTES);
  });

  it("monitor-ui public odin-light.png matches canonical size exactly", () => {
    const canonical = statSync(`${CANONICAL_PROFILES}/odin-light.png`);
    const monitorUi = statSync(`${MONITOR_UI_PUBLIC}/odin-light.png`);
    expect(monitorUi.size).toBe(canonical.size);
  });

  it("dark theme image (odin-dark.png) is unaffected and still present", () => {
    const { size } = statSync(`${MONITOR_UI_PUBLIC}/odin-dark.png`);
    expect(size).toBeGreaterThan(MIN_EXPECTED_BYTES);
  });
});

// ── Sidebar image path per theme ──────────────────────────────────────────────

describe("Sidebar profile image path by theme (issue #1005)", () => {
  it("renders /odin-light.png in light theme", () => {
    localStorage.setItem("fenrir-monitor-theme", "light");
    const { container } = render(
      <Sidebar jobs={[makeJob("x")]} activeSessionId={null} quote="Wisdom" onSelectSession={() => {}} />
    );
    const img = container.querySelector(".brand img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/odin-light.png");
  });

  it("renders /odin-dark.png in dark theme", () => {
    localStorage.setItem("fenrir-monitor-theme", "dark");
    const { container } = render(
      <Sidebar jobs={[makeJob("x")]} activeSessionId={null} quote="Wisdom" onSelectSession={() => {}} />
    );
    const img = container.querySelector(".brand img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/odin-dark.png");
  });

  it("defaults to dark theme (odin-dark.png) when no theme is stored", () => {
    // localStorage is cleared in beforeEach — no stored preference
    const { container } = render(
      <Sidebar jobs={[]} activeSessionId={null} quote="Silence" onSelectSession={() => {}} />
    );
    const img = container.querySelector(".brand img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("/odin-dark.png");
  });

  it("img alt is always 'Odin' regardless of theme", () => {
    localStorage.setItem("fenrir-monitor-theme", "light");
    const { container } = render(
      <Sidebar jobs={[]} activeSessionId={null} quote="Wisdom" onSelectSession={() => {}} />
    );
    const img = container.querySelector(".brand img") as HTMLImageElement | null;
    expect(img?.getAttribute("alt")).toBe("Odin");
  });
});
