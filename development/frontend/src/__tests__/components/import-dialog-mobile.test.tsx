/**
 * Import dialog mobile responsiveness — Issue #1112
 *
 * Verifies that:
 * - DialogContent carries the max-sm full-screen classes from dialog.tsx
 * - ImportWizard DialogContent uses overflow-y-auto (not overflow-hidden)
 * - Action buttons are present and accessible in each import step
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Radix Dialog mock — all exports required by dialog.tsx ───────────────────

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
    ({ children, ...props }, ref) => <button ref={ref} aria-label="Close" {...props}>{children}</button>
  );
  Close.displayName = "Close";

  const Title = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ children, ...props }, ref) => <h2 ref={ref} {...props}>{children}</h2>
  );
  Title.displayName = "Title";

  const Description = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ children, ...props }, ref) => <p ref={ref} {...props}>{children}</p>
  );
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

// ── Hook mocks for ImportWizard ──────────────────────────────────────────────

vi.mock("@/hooks/useSheetImport", () => ({
  useSheetImport: () => ({
    step: "method",
    setStep: vi.fn(),
    url: "",
    setUrl: vi.fn(),
    cards: [],
    warning: null,
    sensitiveDataWarning: false,
    errorCode: null,
    errorMessage: null,
    submit: vi.fn(),
    submitCsv: vi.fn(),
    submitFile: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@/hooks/usePickerConfig", () => ({
  usePickerConfig: () => ({ pickerApiKey: null }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuthContext: () => ({ status: "unauthenticated" }),
}));

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

vi.mock("@/lib/constants", () => ({ KNOWN_ISSUERS: [] }));

// ── Tests: dialog.tsx DialogContent mobile classes ───────────────────────────

describe("dialog.tsx DialogContent — mobile full-screen classes (issue #1112)", () => {
  it("renders with max-sm:inset-0 for full-screen positioning on mobile", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el).not.toBeNull();
    expect(el!.className).toContain("max-sm:inset-0");
  });

  it("renders with max-sm:h-dvh for full viewport height on mobile", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("max-sm:h-dvh");
  });

  it("renders with max-sm:translate-x-0 and max-sm:translate-y-0 to cancel centering", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("max-sm:translate-x-0");
    expect(el!.className).toContain("max-sm:translate-y-0");
  });

  it("renders with max-sm:w-screen to span full viewport width", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("max-sm:w-screen");
  });

  it("renders with max-sm:rounded-none to remove border radius on mobile", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("max-sm:rounded-none");
  });

  it("renders with max-sm:max-h-none to lift height cap on mobile", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(<DialogContent>Hello</DialogContent>);
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("max-sm:max-h-none");
  });

  it("merges extra className with mobile base classes", async () => {
    const { DialogContent } = await import("@/components/ui/dialog");
    const { container } = render(
      <DialogContent className="overflow-y-auto flex flex-col">Hello</DialogContent>
    );
    const el = container.querySelector("[role='dialog']");
    expect(el!.className).toContain("overflow-y-auto");
    expect(el!.className).toContain("max-sm:inset-0");
    expect(el!.className).toContain("max-sm:h-dvh");
  });
});

// ── Tests: ImportWizard DialogContent responsive classes ─────────────────────

describe("ImportWizard — DialogContent responsive classes (issue #1112)", () => {
  it("uses overflow-y-auto (not overflow-hidden) to allow scrolling", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    const { container } = render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.className).toContain("overflow-y-auto");
    expect(dialog!.className).not.toContain("overflow-hidden");
  });

  it("includes max-sm:max-h-none to remove the 90vh cap on mobile", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    const { container } = render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog!.className).toContain("max-sm:max-h-none");
  });

  it("includes max-sm:w-screen to override the 92vw width on mobile", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    const { container } = render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const dialog = container.querySelector("[role='dialog']");
    expect(dialog!.className).toContain("max-sm:w-screen");
  });

  it("still carries the full-screen mobile classes from dialog.tsx base", async () => {
    const { ImportWizard } = await import("@/components/sheets/ImportWizard");
    const { container } = render(
      <ImportWizard open={true} onClose={vi.fn()} onConfirmImport={vi.fn()} existingCards={[]} />
    );
    const dialog = container.querySelector("[role='dialog']");
    // These come from dialog.tsx DialogContent base classes
    expect(dialog!.className).toContain("max-sm:inset-0");
    expect(dialog!.className).toContain("max-sm:h-dvh");
  });
});

// ── Tests: ShareUrlEntry — buttons accessible on mobile ──────────────────────

describe("ShareUrlEntry — action buttons accessible (issue #1112)", () => {
  it("renders Back button", async () => {
    const { ShareUrlEntry } = await import("@/components/sheets/ShareUrlEntry");
    render(
      <ShareUrlEntry url="" setUrl={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} isValid={false} showError={false} />
    );
    expect(screen.getByRole("button", { name: /back/i })).toBeDefined();
  });

  it("renders Begin Import button", async () => {
    const { ShareUrlEntry } = await import("@/components/sheets/ShareUrlEntry");
    render(
      <ShareUrlEntry url="" setUrl={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} isValid={false} showError={false} />
    );
    expect(screen.getByRole("button", { name: /begin import/i })).toBeDefined();
  });

  it("Begin Import is disabled when URL is invalid", async () => {
    const { ShareUrlEntry } = await import("@/components/sheets/ShareUrlEntry");
    render(
      <ShareUrlEntry url="" setUrl={vi.fn()} onSubmit={vi.fn()} onBack={vi.fn()} isValid={false} showError={false} />
    );
    const btn = screen.getByRole("button", { name: /begin import/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("Begin Import is enabled when URL is valid", async () => {
    const { ShareUrlEntry } = await import("@/components/sheets/ShareUrlEntry");
    render(
      <ShareUrlEntry
        url="https://docs.google.com/spreadsheets/d/test"
        setUrl={vi.fn()}
        onSubmit={vi.fn()}
        onBack={vi.fn()}
        isValid={true}
        showError={false}
      />
    );
    const btn = screen.getByRole("button", { name: /begin import/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

// ── Tests: CsvUpload — buttons accessible on mobile ──────────────────────────

describe("CsvUpload — action buttons accessible (issue #1112)", () => {
  it("renders Back button", async () => {
    const { CsvUpload } = await import("@/components/sheets/CsvUpload");
    render(<CsvUpload onSubmit={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("button", { name: /back/i })).toBeDefined();
  });

  it("renders Begin Import button (disabled until file accepted)", async () => {
    const { CsvUpload } = await import("@/components/sheets/CsvUpload");
    render(<CsvUpload onSubmit={vi.fn()} onBack={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /begin import/i }) as HTMLButtonElement;
    expect(btn).toBeDefined();
    expect(btn.disabled).toBe(true);
  });
});

// ── Tests: ImportDedupStep — buttons accessible on mobile ────────────────────

describe("ImportDedupStep — action buttons accessible (issue #1112)", () => {
  const duplicates = [
    {
      imported: { id: "1", cardName: "Chase Sapphire", issuerId: "chase", annualFee: 9500, openDate: "2023-01-01", householdId: "h1" },
      existing: { id: "2", cardName: "Chase Sapphire Preferred", issuerId: "chase", annualFee: 9500, openDate: "2022-06-01", householdId: "h1" },
    },
  ];

  it("renders Skip duplicates button when unique cards exist", async () => {
    const { ImportDedupStep } = await import("@/components/sheets/ImportDedupStep");
    render(
      <ImportDedupStep duplicates={duplicates} uniqueCount={2} onSkipDuplicates={vi.fn()} onImportAll={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /skip.*duplicate/i })).toBeDefined();
  });

  it("renders Import all button", async () => {
    const { ImportDedupStep } = await import("@/components/sheets/ImportDedupStep");
    render(
      <ImportDedupStep duplicates={duplicates} uniqueCount={2} onSkipDuplicates={vi.fn()} onImportAll={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /import all anyway/i })).toBeDefined();
  });

  it("renders Cancel button", async () => {
    const { ImportDedupStep } = await import("@/components/sheets/ImportDedupStep");
    render(
      <ImportDedupStep duplicates={duplicates} uniqueCount={2} onSkipDuplicates={vi.fn()} onImportAll={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
  });

  it("hides Skip button when no unique cards remain (all are duplicates)", async () => {
    const { ImportDedupStep } = await import("@/components/sheets/ImportDedupStep");
    render(
      <ImportDedupStep duplicates={duplicates} uniqueCount={0} onSkipDuplicates={vi.fn()} onImportAll={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /skip/i })).toBeNull();
  });
});
