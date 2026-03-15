/**
 * UmamiScript.test.tsx
 *
 * Vitest suite for the UmamiScript analytics component — Issue #782.
 * Verifies conditional rendering and correct attribute wiring.
 *
 * Note: @testing-library/jest-dom is not installed; uses native assertions.
 */

import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UmamiScript } from "@/components/analytics/UmamiScript";

// ── Mocks ────────────────────────────────────────────────────────────────────

// next/script renders a <script> in jsdom — mock to capture props directly.
vi.mock("next/script", () => ({
  default: (props: Record<string, unknown>) => (
    <script
      data-testid="umami-script"
      data-src={props.src as string}
      data-website-id={props["data-website-id"] as string}
      data-strategy={props.strategy as string}
      nonce={props.nonce as string | undefined}
    />
  ),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("UmamiScript", () => {
  it("renders nothing when websiteId is undefined", () => {
    const { container } = render(<UmamiScript />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when websiteId is an empty string", () => {
    const { container } = render(<UmamiScript websiteId="" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders the script tag when websiteId is provided", () => {
    const { getByTestId } = render(
      <UmamiScript websiteId="test-uuid-1234" />
    );
    const el = getByTestId("umami-script");
    expect(el).toBeTruthy();
  });

  it("points to the correct Umami instance URL", () => {
    const { getByTestId } = render(
      <UmamiScript websiteId="test-uuid-1234" />
    );
    expect(getByTestId("umami-script").getAttribute("data-src")).toBe(
      "https://analytics.fenrirledger.com/script.js"
    );
  });

  it("forwards the websiteId as data-website-id attribute", () => {
    const siteId = "abc-123-def-456";
    const { getByTestId } = render(<UmamiScript websiteId={siteId} />);
    expect(
      getByTestId("umami-script").getAttribute("data-website-id")
    ).toBe(siteId);
  });

  it("uses afterInteractive strategy (non-blocking)", () => {
    const { getByTestId } = render(
      <UmamiScript websiteId="test-uuid-1234" />
    );
    expect(
      getByTestId("umami-script").getAttribute("data-strategy")
    ).toBe("afterInteractive");
  });

  it("forwards nonce when provided", () => {
    const { getByTestId } = render(
      <UmamiScript websiteId="test-uuid-1234" nonce="abc123" />
    );
    expect(getByTestId("umami-script").getAttribute("nonce")).toBe("abc123");
  });

  it("omits nonce attribute when not provided", () => {
    const { getByTestId } = render(
      <UmamiScript websiteId="test-uuid-1234" />
    );
    // nonce should be null or empty (not set)
    const nonce = getByTestId("umami-script").getAttribute("nonce");
    expect(nonce === null || nonce === "").toBe(true);
  });
});
