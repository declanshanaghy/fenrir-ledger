/**
 * Loki QA tests for CodeCharInput component
 *
 * Tests keyboard/paste behaviour, aria attributes, and input filtering.
 * Issue #1123 — Household invite code flow
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CodeCharInput } from "@/components/household/CodeCharInput";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInput(overrides: Partial<React.ComponentProps<typeof CodeCharInput>> = {}) {
  const onChange = vi.fn();
  const onBackspace = vi.fn();
  const onPaste = vi.fn();
  const utils = render(
    <CodeCharInput
      index={0}
      value=""
      onChange={onChange}
      onBackspace={onBackspace}
      onPaste={onPaste}
      {...overrides}
    />
  );
  const input = screen.getByRole("textbox") as HTMLInputElement;
  return { input, onChange, onBackspace, onPaste, ...utils };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CodeCharInput — behaviour", () => {
  describe("aria attributes", () => {
    it("has aria-label 'Character 1 of 6' for index 0", () => {
      renderInput({ index: 0 });
      expect(screen.getByLabelText("Character 1 of 6")).toBeDefined();
    });

    it("has aria-label 'Character 4 of 6' for index 3", () => {
      renderInput({ index: 3 });
      expect(screen.getByLabelText("Character 4 of 6")).toBeDefined();
    });
  });

  describe("input filtering", () => {
    it("calls onChange with uppercase single char for letter key", () => {
      const { input, onChange } = renderInput({ index: 2 });
      fireEvent.change(input, { target: { value: "a" } });
      expect(onChange).toHaveBeenCalledWith(2, "A");
    });

    it("calls onChange with digit for numeric key", () => {
      const { input, onChange } = renderInput({ index: 0 });
      fireEvent.change(input, { target: { value: "7" } });
      expect(onChange).toHaveBeenCalledWith(0, "7");
    });

    it("calls onChange with empty string when special character entered", () => {
      const { input, onChange } = renderInput({ index: 0 });
      fireEvent.change(input, { target: { value: "!" } });
      expect(onChange).toHaveBeenCalledWith(0, "");
    });

    it("calls onChange with empty string for space character", () => {
      const { input, onChange } = renderInput({ index: 0 });
      fireEvent.change(input, { target: { value: " " } });
      expect(onChange).toHaveBeenCalledWith(0, "");
    });

    it("takes only last character when two chars somehow appear in value", () => {
      const { input, onChange } = renderInput({ index: 0 });
      fireEvent.change(input, { target: { value: "AB" } });
      // slice(-1) means last char
      expect(onChange).toHaveBeenCalledWith(0, "B");
    });
  });

  describe("backspace navigation", () => {
    it("calls onBackspace with current index on Backspace keydown", () => {
      const { input, onBackspace } = renderInput({ index: 3 });
      fireEvent.keyDown(input, { key: "Backspace" });
      expect(onBackspace).toHaveBeenCalledWith(3);
    });

    it("does not call onBackspace for other keys", () => {
      const { input, onBackspace } = renderInput({ index: 0 });
      fireEvent.keyDown(input, { key: "ArrowLeft" });
      expect(onBackspace).not.toHaveBeenCalled();
    });
  });

  describe("paste handling", () => {
    it("calls onPaste with trimmed uppercase text", () => {
      const { input, onPaste } = renderInput({ index: 0 });
      fireEvent.paste(input, {
        clipboardData: { getData: () => " abc123 " },
      });
      expect(onPaste).toHaveBeenCalledWith("ABC123");
    });

    it("calls onPaste when paste occurs on any cell (index 3)", () => {
      const { input, onPaste } = renderInput({ index: 3 });
      fireEvent.paste(input, {
        clipboardData: { getData: () => "X7K2NP" },
      });
      expect(onPaste).toHaveBeenCalledWith("X7K2NP");
    });
  });

  describe("disabled state", () => {
    it("renders as disabled when disabled prop is true", () => {
      renderInput({ disabled: true });
      expect((screen.getByRole("textbox") as HTMLInputElement).disabled).toBe(true);
    });
  });

  describe("error state", () => {
    it("renders with error border class when hasError is true", () => {
      renderInput({ hasError: true });
      const input = screen.getByRole("textbox");
      expect(input.className).toContain("border-destructive");
    });

    it("renders with foreground border class when value is set (no error)", () => {
      renderInput({ value: "A", hasError: false });
      const input = screen.getByRole("textbox");
      expect(input.className).toContain("border-foreground");
    });
  });
});
