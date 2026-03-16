import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── shadcn/ui CSS variable tokens ───────────────────────────────────
      colors: {
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",

        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          hover:      "hsl(var(--card-hover))",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input:  "hsl(var(--input))",
        ring:   "hsl(var(--ring))",

        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },

        // ── Saga Ledger direct color tokens ───────────────────────────────
        // Surfaces
        void:  "#12100e",
        forge: "#1c1917",
        chain: "#242120",

        // Gold
        gold: {
          dim:     "#8a6a10",
          DEFAULT: "#d4a520",
          bright:  "#f0c040",
        },

        // Ice blue (wolf's eye — atmospheric accent only)
        ice: "#5b9ec9",

        // Norse realm status colors
        realm: {
          asgard:   "#0a8c6e",   // active — teal
          hati:     "#f59e0b",   // promo expiring — amber
          muspel:   "#c94a0a",   // fee approaching — blood orange
          ragnarok: "#ef4444",   // overdue — red
          hel:      "#8a8578",   // closed — stone
        },

        // Text
        saga: "#f0ede4",         // primary text — lighter parchment
        rune: "#a09888",         // secondary text — lighter stone gray
      },

      // ── Typography ────────────────────────────────────────────────────────
      fontFamily: {
        display: ["var(--font-cinzel-decorative)", "serif"],
        heading:  ["var(--font-cinzel)", "serif"],
        body:     ["var(--font-source-serif)", "serif"],
        mono:     ["var(--font-mono)", "monospace"],
      },

      // ── Border radius (sharp, angular) ──────────────────────────────────
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      // ── Keyframes — household invite flow (issue #1123) ──────────────────
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "20%":      { transform: "translateX(-4px)" },
          "40%":      { transform: "translateX(4px)" },
          "60%":      { transform: "translateX(-3px)" },
          "80%":      { transform: "translateX(3px)" },
        },
        fadeSlideIn: {
          "0%":   { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        sagaEnter: {
          "0%":   { opacity: "0", transform: "scale(0.96) translateY(4px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        indeterminate: {
          "0%":   { transform: "translateX(-100%)" },
          "50%":  { transform: "translateX(0%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        shake:         "shake 150ms ease-out",
        fadeSlideIn:   "fadeSlideIn 300ms cubic-bezier(0.16,1,0.3,1)",
        sagaEnter:     "sagaEnter 300ms cubic-bezier(0.16,1,0.3,1)",
        indeterminate: "indeterminate 1.5s ease-in-out infinite",
      },

      // ── Shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        "gold-sm": "0 0 8px rgba(212, 165, 32, 0.20)",
        "gold-md": "0 0 20px rgba(212, 165, 32, 0.25)",
        "gold-lg": "0 0 40px rgba(212, 165, 32, 0.30)",
        "muspel":  "0 0 20px rgba(201, 74, 10, 0.35)",
        "card-hover":
          "0 0 0 1px #4a4540, 0 0 20px rgba(212, 165, 32, 0.18)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
