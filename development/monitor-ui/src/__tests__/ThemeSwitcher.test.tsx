/**
 * Component tests for ThemeSwitcher — Issue #964
 * Covers rendering and click behavior not addressed in useTheme.test.ts
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "../components/ThemeSwitcher";

afterEach(cleanup);

describe("ThemeSwitcher rendering", () => {
  it("renders Light and Dark buttons", () => {
    const { container } = render(<ThemeSwitcher theme="dark" setTheme={vi.fn()} />);
    const root = within(container);
    expect(root.getByRole("button", { name: /light/i })).toBeDefined();
    expect(root.getByRole("button", { name: /dark/i })).toBeDefined();
  });

  it("Light button aria-pressed=true when theme is light", () => {
    const { container } = render(<ThemeSwitcher theme="light" setTheme={vi.fn()} />);
    const root = within(container);
    expect(root.getByRole("button", { name: /light/i }).getAttribute("aria-pressed")).toBe("true");
    expect(root.getByRole("button", { name: /dark/i }).getAttribute("aria-pressed")).toBe("false");
  });

  it("Dark button aria-pressed=true when theme is dark", () => {
    const { container } = render(<ThemeSwitcher theme="dark" setTheme={vi.fn()} />);
    const root = within(container);
    expect(root.getByRole("button", { name: /dark/i }).getAttribute("aria-pressed")).toBe("true");
    expect(root.getByRole("button", { name: /light/i }).getAttribute("aria-pressed")).toBe("false");
  });
});

describe("ThemeSwitcher interactions", () => {
  it("clicking Light button calls setTheme('light')", async () => {
    const setTheme = vi.fn();
    const { container } = render(<ThemeSwitcher theme="dark" setTheme={setTheme} />);
    await userEvent.click(within(container).getByRole("button", { name: /light/i }));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("clicking Dark button calls setTheme('dark')", async () => {
    const setTheme = vi.fn();
    const { container } = render(<ThemeSwitcher theme="light" setTheme={setTheme} />);
    await userEvent.click(within(container).getByRole("button", { name: /dark/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
