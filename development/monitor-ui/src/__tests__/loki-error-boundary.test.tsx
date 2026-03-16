/**
 * Vitest tests for issue #1037 — Loki Error Boundary Norse tablet restyle.
 *
 * AC tested:
 * - ErrorBoundary renders children when no error
 * - ErrorBoundary renders Loki tablet (role="alert") when error is caught
 * - Loki tablet displays the error.message in the inscription block
 * - Loki tablet contains expected copy: heading, subheading, avatar label
 * - Retry button ("Reweave the Thread") resets the error state
 * - Custom fallback prop renders instead of Loki tablet
 * - aria attributes: role="alert", aria-live="assertive", aria-label
 * - Rune/decorative elements are aria-hidden
 * - Seal block is aria-hidden
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";
import { Component, useState } from "react";
import type { ReactNode } from "react";
import { ErrorBoundary } from "../components/ErrorBoundary";

afterEach(cleanup);

// ── Test helpers ──────────────────────────────────────────────────────────────

/** A component that throws on render when `shouldThrow` is true. */
class ThrowingChild extends Component<{ shouldThrow: boolean; message?: string }> {
  override render(): ReactNode {
    if (this.props.shouldThrow) {
      throw new Error(this.props.message ?? "Test render error");
    }
    return <div data-testid="healthy-child">All good</div>;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ErrorBoundary — Loki tablet (issue #1037)", () => {

  it("renders children when no error", () => {
    const { getByTestId, queryByRole } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </ErrorBoundary>
    );
    expect(getByTestId("healthy-child")).toBeTruthy();
    expect(queryByRole("alert")).toBeNull();
  });

  it("renders the Loki tablet with role=alert when a child throws", () => {
    const { getByRole } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const tablet = getByRole("alert");
    expect(tablet).toBeTruthy();
    expect(tablet.getAttribute("aria-live")).toBe("assertive");
    expect(tablet.getAttribute("aria-label")).toBe("Loki has captured a component error");
  });

  it("displays error.message in the inscription block", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} message="Cannot read properties of undefined (reading 'map')" />
      </ErrorBoundary>
    );
    expect(getByText("Cannot read properties of undefined (reading 'map')")).toBeTruthy();
  });

  it("shows the Loki thematic heading", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText("The Trickster Has Snared This Thread")).toBeTruthy();
  });

  it("shows the Loki avatar label readable by screen readers", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText("Loki · The Trickster")).toBeTruthy();
  });

  it("shows the inscription label for the error message", () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByText("Captured Inscription (error.message)")).toBeTruthy();
  });

  it("retry button has correct copy and aria-label", () => {
    const { getByRole } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const btn = getByRole("button");
    expect(btn.textContent?.trim()).toBe("Reweave the Thread");
    expect(btn.getAttribute("aria-label")).toBe("Reweave the Thread — retry this component");
    expect(btn.getAttribute("type")).toBe("button");
  });

  it("retry button resets error state and re-renders children on success", () => {
    // Wrapper controls shouldThrow via state — avoids mutable-variable issues
    // with React 18 concurrent rendering (which may double-invoke function components).
    function TestWrapper() {
      const [allowRender, setAllowRender] = useState(false);
      return (
        <div>
          <button data-testid="enable-success" onClick={() => setAllowRender(true)}>
            enable success
          </button>
          <ErrorBoundary>
            <ThrowingChild shouldThrow={!allowRender} />
          </ErrorBoundary>
        </div>
      );
    }

    const { getByRole, getByTestId } = render(<TestWrapper />);

    // Loki tablet visible after initial throw
    expect(getByRole("alert")).toBeTruthy();

    // Enable successful rendering before retry
    act(() => { fireEvent.click(getByTestId("enable-success")); });

    // Click "Reweave the Thread" — ErrorBoundary resets hasError → children re-render
    act(() => { fireEvent.click(getByRole("button", { name: /reweave/i })); });

    // Children now render without throwing
    expect(getByTestId("healthy-child")).toBeTruthy();
  });

  it("renders custom fallback prop instead of Loki tablet", () => {
    const customFallback = <div data-testid="custom-fallback">Custom Error UI</div>;
    const { getByTestId, queryByRole } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByTestId("custom-fallback")).toBeTruthy();
    // Loki tablet's role="alert" should NOT appear (custom fallback has no role="alert")
    expect(queryByRole("alert")).toBeNull();
  });

  it("loki-eb-tablet has the correct CSS class", () => {
    const { getByRole } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    expect(getByRole("alert").classList.contains("loki-eb-tablet")).toBe(true);
  });

  it("rune border elements are aria-hidden", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const runeBorders = container.querySelectorAll(".loki-eb-rune-border");
    runeBorders.forEach((el) => {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("seal block is aria-hidden", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const seal = container.querySelector(".loki-eb-seal");
    expect(seal).toBeTruthy();
    expect(seal!.getAttribute("aria-hidden")).toBe("true");
  });

  it("avatar rune is aria-hidden", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const avatarRune = container.querySelector(".loki-eb-avatar-rune");
    expect(avatarRune).toBeTruthy();
    expect(avatarRune!.getAttribute("aria-hidden")).toBe("true");
  });

  it("divider is aria-hidden", () => {
    const { container } = render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>
    );
    const divider = container.querySelector(".loki-eb-divider");
    expect(divider).toBeTruthy();
    expect(divider!.getAttribute("aria-hidden")).toBe("true");
  });
});
