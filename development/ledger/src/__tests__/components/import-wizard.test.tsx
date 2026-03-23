/**
 * ImportWizard — canonical unit tests
 *
 * Consolidates issue-numbered test clusters:
 *   - import-wizard-1687.test.tsx (Regression: #1687)
 *   - import-wizard-1740.test.tsx (Regression: #1740)
 *
 * Covers: step routing, titles, aria-live announcements, loading messages,
 * error messages, success content, and the Continue button (#1740).
 *
 * @ref Issue #1687, #1740
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Mock } from "vitest";

// ── Radix Dialog mock ─────────────────────────────────────────────────────────

vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
  const React = await import("react");
  const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();

  const Overlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => <div ref={ref} className={className} {...props} />
  );
  Overlay.displayName = "Overlay";

  const Content = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
      <div ref={ref} role="dialog" className={className} {...props}>
        {children}
      </div>
    )
  );
  Content.displayName = "Content";

  const Close = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
    ({ children, ...props }, ref) => (
      <button ref={ref} aria-label="Close" {...props}>
        {children}
      </button>
    )
  );
  Close.displayName = "Close";

  const Title = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => <h2 ref={ref} {...props}>{children}</h2>
  );
  Title.displayName = "Title";

  const Description = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
  >(({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>);
  Description.displayName = "Description";

  return {
    ...actual,
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open !== false ? <>{children}</> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay,
    Content,
    Close,
    Title,
    Description,
  };
});

// ── Shared hook mock state ────────────────────────────────────────────────────

const mockHookState = {
  step: "method" as string,
  setStep: vi.fn(),
  url: "",
  setUrl: vi.fn(),
  cards: [] as object[],
  warning: undefined as string | undefined,
  sensitiveDataWarning: false,
  errorCode: null as string | null,
  errorMessage: "",
  submit: vi.fn(),
  submitCsv: vi.fn(),
  submitFile: vi.fn(),
  cancel: vi.fn(),
  reset: vi.fn(),
};

vi.mock("@/hooks/useSheetImport", () => ({
  useSheetImport: () => mockHookState,
}));

vi.mock("@/hooks/usePickerConfig", () => ({
  usePickerConfig: () => ({ pickerApiKey: null }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({ status: "unauthenticated" }),
}));

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));
vi.mock("@/lib/constants", () => ({ KNOWN_ISSUERS: [] }));

// ── Render helper ─────────────────────────────────────────────────────────────

async function renderWizard(overrides: Partial<typeof mockHookState> = {}) {
  Object.assign(mockHookState, overrides);
  const { ImportWizard } = await import("@/components/sheets/ImportWizard");
  return render(
    <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
  );
}

// ── Tests: step "method" ──────────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="method"', () => {
  beforeAll(() => {
    mockHookState.step = "method";
  });

  it("renders Import Cards title", async () => {
    await renderWizard({ step: "method" });
    expect(screen.getByText("Import Cards")).toBeDefined();
  });

  it("aria-live announces Step 1", async () => {
    await renderWizard({ step: "method" });
    expect(screen.getByText("Step 1: Choose import method")).toBeDefined();
  });
});

// ── Tests: step "url-entry" ───────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="url-entry"', () => {
  it("renders Share a Rune Tablet title", async () => {
    await renderWizard({ step: "url-entry" });
    expect(screen.getByText("Share a Rune Tablet")).toBeDefined();
  });

  it("aria-live announces Step 2 url-entry", async () => {
    await renderWizard({ step: "url-entry" });
    expect(screen.getByText("Step 2: Enter Google Sheets URL")).toBeDefined();
  });
});

// ── Tests: step "csv-upload" ──────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="csv-upload"', () => {
  it("renders Deliver a Rune-Stone title", async () => {
    await renderWizard({ step: "csv-upload" });
    expect(screen.getByText("Deliver a Rune-Stone")).toBeDefined();
  });

  it("aria-live announces Step 2 csv-upload", async () => {
    await renderWizard({ step: "csv-upload" });
    expect(screen.getByText("Step 2: Upload CSV file")).toBeDefined();
  });
});

// ── Tests: step "loading" ─────────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="loading"', () => {
  it("renders Deciphering the runes title", async () => {
    await renderWizard({ step: "loading" });
    expect(screen.getByText("Deciphering the runes...")).toBeDefined();
  });

  it("renders Cancel button", async () => {
    await renderWizard({ step: "loading" });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });

  it("aria-live announces loading", async () => {
    await renderWizard({ step: "loading" });
    expect(
      screen.getByText("Loading: extracting cards from your data")
    ).toBeDefined();
  });
});

// ── Tests: LoadingStepContent message variants ────────────────────────────────

// Regression: #1687
describe("LoadingStepContent — loading message by import method", () => {
  it("shows spreadsheet message when importMethod is null (url import path)", async () => {
    await renderWizard({ step: "loading" });
    expect(
      screen.getByText("Reading the runes from your spreadsheet...")
    ).toBeDefined();
  });
});

// ── Tests: step "preview" ─────────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="preview"', () => {
  it("renders Preview Import title", async () => {
    await renderWizard({ step: "preview", cards: [] });
    expect(screen.getByText("Preview Import")).toBeDefined();
  });

  it("shows card count badge", async () => {
    await renderWizard({
      step: "preview",
      cards: [
        { id: "c1", cardName: "Test Card", issuerId: "chase", annualFee: 9500, openDate: "2023-01-01" },
        { id: "c2", cardName: "Another Card", issuerId: "amex", annualFee: 0, openDate: "2022-06-01" },
      ],
    });
    expect(screen.getByText("2 cards")).toBeDefined();
  });

  it("shows singular 'card' when count is 1", async () => {
    await renderWizard({
      step: "preview",
      cards: [{ id: "c1", cardName: "Solo Card", issuerId: "chase", annualFee: 0, openDate: "2023-01-01" }],
    });
    expect(screen.getByText("1 card")).toBeDefined();
  });

  it("renders Import button", async () => {
    await renderWizard({ step: "preview", cards: [] });
    expect(screen.getByRole("button", { name: /import/i })).toBeDefined();
  });

  it("renders Cancel button", async () => {
    await renderWizard({ step: "preview", cards: [] });
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });

  it("shows warning banner when warning is set", async () => {
    await renderWizard({
      step: "preview",
      cards: [],
      warning: "Some data may be incomplete",
    });
    expect(screen.getByText("Some data may be incomplete")).toBeDefined();
  });

  it("does not show warning banner when warning is undefined", async () => {
    await renderWizard({ step: "preview", cards: [], warning: undefined });
    expect(screen.queryByText("Some data may be incomplete")).toBeNull();
  });

  it("aria-live announces preview card count", async () => {
    await renderWizard({
      step: "preview",
      cards: [
        { id: "c1", cardName: "X", issuerId: "chase", annualFee: 0, openDate: "2023-01-01" },
        { id: "c2", cardName: "Y", issuerId: "amex", annualFee: 0, openDate: "2022-01-01" },
        { id: "c3", cardName: "Z", issuerId: "citi", annualFee: 0, openDate: "2021-01-01" },
      ],
    });
    expect(screen.getByText("Preview: 3 cards ready to import")).toBeDefined();
  });
});

// ── Tests: step "error" ───────────────────────────────────────────────────────

// Regression: #1687
describe('ImportWizard step="error"', () => {
  it("renders Import Failed title", async () => {
    await renderWizard({ step: "error", errorCode: null, errorMessage: "" });
    expect(screen.getByText("Import Failed")).toBeDefined();
  });

  it("renders Close and Try Again buttons", async () => {
    await renderWizard({ step: "error", errorCode: null, errorMessage: "Oops" });
    const closeButtons = screen.getAllByRole("button", { name: /close/i });
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: /try again/i })).toBeDefined();
  });

  it("shows ERROR_MESSAGES text for known error code", async () => {
    await renderWizard({ step: "error", errorCode: "INVALID_URL", errorMessage: "" });
    expect(
      screen.getByText("The URL doesn't look like a Google Sheets link.")
    ).toBeDefined();
  });

  it("shows raw errorMessage when errorCode is null", async () => {
    await renderWizard({ step: "error", errorCode: null, errorMessage: "Custom error text" });
    expect(screen.getByText("Custom error text")).toBeDefined();
  });

  it("shows SHEET_NOT_PUBLIC message for that error code", async () => {
    await renderWizard({ step: "error", errorCode: "SHEET_NOT_PUBLIC", errorMessage: "" });
    expect(
      screen.getByText(
        "This spreadsheet isn't publicly accessible. Share it with 'Anyone with the link can view'."
      )
    ).toBeDefined();
  });

  it("shows RATE_LIMITED message", async () => {
    await renderWizard({ step: "error", errorCode: "RATE_LIMITED", errorMessage: "" });
    expect(
      screen.getByText("You've exceeded the maximum uploads per hour. Please try again later.")
    ).toBeDefined();
  });

  it("shows SUBSCRIPTION_REQUIRED message", async () => {
    await renderWizard({ step: "error", errorCode: "SUBSCRIPTION_REQUIRED", errorMessage: "" });
    expect(
      screen.getByText("Import requires a Karl subscription. Upgrade to unlock this feature.")
    ).toBeDefined();
  });

  it("aria-live announces error", async () => {
    await renderWizard({ step: "error", errorCode: null, errorMessage: "" });
    expect(screen.getByText("Error: import failed")).toBeDefined();
  });
});

// ── Tests: step "success" ─────────────────────────────────────────────────────

// Regression: #1687, #1740
describe('ImportWizard step="success"', () => {
  it("renders Cards imported! title", async () => {
    await renderWizard({ step: "success" });
    expect(screen.getByText("Cards imported!")).toBeDefined();
  });

  it("renders the Norse rune glyph", async () => {
    await renderWizard({ step: "success" });
    expect(screen.getByText("ᚠ")).toBeDefined();
  });

  it("aria-live announces success", async () => {
    await renderWizard({ step: "success" });
    expect(screen.getByText("Success: cards imported")).toBeDefined();
  });

  // Regression: #1740 — Continue button added to success screen
  it("renders a Continue button on the success screen", async () => {
    await renderWizard({ step: "success" });
    expect(screen.getByRole("button", { name: /continue/i })).toBeDefined();
  });

  it("calls onClose when Continue is clicked", async () => {
    const onClose = vi.fn();
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    render(
      <ImportWizard open={true} onClose={onClose} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("Continue button has full-width class", async () => {
    await renderWizard({ step: "success" });
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("w-full");
  });

  it("Continue button has primary action styling (bg-primary)", async () => {
    await renderWizard({ step: "success" });
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("bg-primary");
  });

  it("Continue button has minimum 44px touch target (h-11)", async () => {
    await renderWizard({ step: "success" });
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("h-11");
  });
});

// ── Tests: aria-live region ───────────────────────────────────────────────────

// Regression: #1687
describe("AriaLiveRegion — step announcements", () => {
  it("announces picker step", async () => {
    await renderWizard({ step: "picker" });
    expect(screen.getByText("Step 2: Browsing Google Drive")).toBeDefined();
  });

  it("announces dedup step with 0 duplicates when dedupResult is null", async () => {
    await renderWizard({ step: "dedup" });
    expect(screen.getByText("Duplicates found: 0 duplicate cards detected")).toBeDefined();
  });
});
