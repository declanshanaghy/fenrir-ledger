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
        onClick={() => setTheme("light")}
      >
        ☀ Light
      </button>
      <button
        className="theme-btn"
        aria-pressed={theme === "dark"}
        onClick={() => setTheme("dark")}
      >
        ☽ Dark
      </button>
    </div>
  );
}
