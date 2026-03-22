/**
 * jest-dom-integration.test.tsx
 *
 * Vitest integration tests validating that @testing-library/jest-dom (issue #1371)
 * is correctly installed, globally available via setup.ts, and all key matchers work.
 *
 * Acceptance criteria verified:
 * - Package installed as dev dependency
 * - Global import works (no per-file import needed)
 * - Key matchers: toBeInTheDocument, toBeVisible, toHaveTextContent,
 *   toHaveAttribute, toHaveClass, not.toBeInTheDocument
 * - toBeInTheDocument correctly distinguishes present vs absent elements
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

// ── Helpers ───────────────────────────────────────────────────────────────────

function TestFixture({ show }: { show: boolean }) {
  return (
    <div>
      {show && (
        <p
          data-testid="visible-element"
          className="active primary"
          aria-label="test-label"
        >
          Hello World
        </p>
      )}
      <span data-testid="always-present">always here</span>
      <button data-testid="hidden-btn" style={{ display: "none" }}>
        hidden
      </button>
    </div>
  );
}

// ── jest-dom availability (AC: global import via setup.ts) ────────────────────

describe("jest-dom global availability (issue #1371)", () => {
  it("toBeInTheDocument matcher is available without per-file import", () => {
    render(<TestFixture show={true} />);
    // If jest-dom was not globally loaded, this call would throw TypeError
    expect(screen.getByTestId("always-present")).toBeInTheDocument();
  });

  it("not.toBeInTheDocument matcher works for absent elements", () => {
    render(<TestFixture show={false} />);
    expect(screen.queryByTestId("visible-element")).not.toBeInTheDocument();
  });
});

// ── Core matchers (AC: key jest-dom matchers exercised) ───────────────────────

describe("jest-dom matchers — toBeInTheDocument", () => {
  it("element rendered in DOM passes toBeInTheDocument", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toBeInTheDocument();
  });

  it("element absent from DOM fails toBeInTheDocument (queryBy returns null)", () => {
    render(<TestFixture show={false} />);
    const el = screen.queryByTestId("visible-element");
    expect(el).not.toBeInTheDocument();
  });
});

describe("jest-dom matchers — toHaveTextContent", () => {
  it("element with matching text passes toHaveTextContent", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveTextContent("Hello World");
  });

  it("toHaveTextContent supports partial match", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveTextContent("Hello");
  });

  it("toHaveTextContent supports regex", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveTextContent(/world/i);
  });
});

describe("jest-dom matchers — toHaveAttribute", () => {
  it("element with aria-label passes toHaveAttribute", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveAttribute(
      "aria-label",
      "test-label"
    );
  });

  it("not.toHaveAttribute works for absent attribute", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).not.toHaveAttribute("href");
  });
});

describe("jest-dom matchers — toHaveClass", () => {
  it("element with matching class passes toHaveClass", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveClass("active");
  });

  it("toHaveClass matches multiple classes", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toHaveClass("active", "primary");
  });

  it("not.toHaveClass works for absent class", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).not.toHaveClass("disabled");
  });
});

describe("jest-dom matchers — toBeVisible", () => {
  it("visible element passes toBeVisible", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("visible-element")).toBeVisible();
  });

  it("display:none element fails toBeVisible", () => {
    render(<TestFixture show={true} />);
    expect(screen.getByTestId("hidden-btn")).not.toBeVisible();
  });
});

// ── Migration pattern validation (AC: raw DOM → jest-dom conversions) ─────────

describe("jest-dom migration patterns (issue #1371 acceptance criteria)", () => {
  it("toBeInTheDocument replaces: expect(el).not.toBeNull()", () => {
    render(<TestFixture show={true} />);
    // Old: expect(el).not.toBeNull()
    // New (canonical):
    expect(screen.getByTestId("visible-element")).toBeInTheDocument();
  });

  it("not.toBeInTheDocument replaces: expect(el).toBeNull()", () => {
    render(<TestFixture show={false} />);
    // Old: expect(el).toBeNull()
    // New (canonical):
    expect(screen.queryByTestId("visible-element")).not.toBeInTheDocument();
  });

  it("toHaveTextContent replaces: expect(el.textContent).toBe('X')", () => {
    render(<TestFixture show={true} />);
    // Old: expect(el.textContent).toBe('Hello World')
    // New (canonical):
    expect(screen.getByTestId("visible-element")).toHaveTextContent("Hello World");
  });

  it("toHaveClass replaces: expect(el.className).toContain('X')", () => {
    render(<TestFixture show={true} />);
    // Old: expect(el.className).toContain('active')
    // New (canonical):
    expect(screen.getByTestId("visible-element")).toHaveClass("active");
  });
});
