/**
 * ImportWizard Continue button — Issue #1740
 *
 * Verifies the Continue button on the success step:
 * - Renders on the success screen
 * - Calls onClose when clicked
 * - Styled as a primary action (full width)
 * - Has adequate touch target (h-11 = 44px)
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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

// ── Hook mocks ────────────────────────────────────────────────────────────────

const mockHookState = {
  step: "success" as string,
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

// ── Tests: Continue button on success step ────────────────────────────────────

describe('ImportWizard step="success" — Continue button (#1740)', () => {
  it("renders a Continue button on the success screen", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
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
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("w-full");
  });

  it("Continue button has primary action styling (bg-primary)", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("bg-primary");
  });

  it("Continue button has minimum 44px touch target (h-11)", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const continueBtn = screen.getByRole("button", { name: /continue/i });
    expect(continueBtn.className).toContain("h-11");
  });
});
