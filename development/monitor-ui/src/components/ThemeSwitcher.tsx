import type { Theme } from "../hooks/useTheme";

interface Props {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export function ThemeSwitcher({ theme, setTheme }: Props) {
  return (
    <div role="group" aria-label="Choose theme" className="theme-switcher">
      <button
        className="theme-btn"
        aria-pressed={theme === "light"}
        aria-label="Light theme"
        onClick={() => setTheme("light")}
      >
        ☀
      </button>
      <button
        className="theme-btn"
        aria-pressed={theme === "dark"}
        aria-label="Dark theme"
        onClick={() => setTheme("dark")}
      >
        ☽
      </button>
    </div>
  );
}
