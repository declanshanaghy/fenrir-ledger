/**
 * Shared dialog and animation mock factories for component tests.
 *
 * Usage inside vi.mock() factories:
 *
 *   vi.mock("framer-motion", () => require("../mocks/dialog-mocks").framerMotionMock);
 *
 *   vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
 *     const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();
 *     return require("../mocks/dialog-mocks").makeRadixDialogMock(actual);
 *   });
 */

import React from "react";

// ── framer-motion ─────────────────────────────────────────────────────────────

/** framer-motion — passthrough motion.div, transparent AnimatePresence */
export const framerMotionMock = {
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        custom?: unknown;
        variants?: unknown;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }
    >(({ children, className, ...rest }, ref) =>
      React.createElement("div", { ref, className, ...rest }, children),
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  useReducedMotion: () => true,
};

// ── @radix-ui/react-dialog ────────────────────────────────────────────────────

/**
 * Build a @radix-ui/react-dialog mock with passthrough components.
 *
 * @param actual - Spread of the real module exports (from importOriginal).
 *                 Pass an empty object when importOriginal is not available.
 */
export function makeRadixDialogMock(actual: Record<string, unknown> = {}) {
  const Overlay = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, ...props }, ref) =>
    React.createElement("div", { ref, className, ...props }),
  );
  Overlay.displayName = "Overlay";

  const Content = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, children, ...props }, ref) =>
    React.createElement("div", { ref, role: "dialog", className, ...props }, children),
  );
  Content.displayName = "Content";

  const Close = React.forwardRef<
    HTMLButtonElement,
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >(({ children, ...props }, ref) =>
    React.createElement("button", { ref, "aria-label": "Close", ...props }, children),
  );
  Close.displayName = "Close";

  const Title = React.forwardRef<
    HTMLHeadingElement,
    React.HTMLAttributes<HTMLHeadingElement>
  >(({ children, ...props }, ref) =>
    React.createElement("h2", { ref, ...props }, children),
  );
  Title.displayName = "Title";

  const Description = React.forwardRef<
    HTMLParagraphElement,
    React.HTMLAttributes<HTMLParagraphElement>
  >(({ children, ...props }, ref) =>
    React.createElement("p", { ref, ...props }, children),
  );
  Description.displayName = "Description";

  return {
    ...actual,
    Root: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
      open !== false
        ? React.createElement(React.Fragment, null, children)
        : null,
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    Overlay,
    Content,
    Close,
    Title,
    Description,
  };
}
