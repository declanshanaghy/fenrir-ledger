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
        void:  "#07070d",
        forge: "#0f1018",
        chain: "#13151f",

        // Gold
        gold: {
          dim:     "#8a6a00",
          DEFAULT: "#c9920a",
          bright:  "#f0b429",
        },

        // Norse realm status colors
        realm: {
          asgard:   "#0a8c6e",   // active — teal
          hati:     "#f59e0b",   // promo expiring — amber
          muspel:   "#c94a0a",   // fee approaching — blood orange
          ragnarok: "#ef4444",   // overdue — red
          hel:      "#8a8578",   // closed — stone
        },

        // Text
        saga: "#e8e4d4",         // primary text
        rune: "#8a8578",         // secondary text
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

      // ── Shadows ───────────────────────────────────────────────────────────
      boxShadow: {
        "gold-sm": "0 0 8px rgba(201, 146, 10, 0.20)",
        "gold-md": "0 0 20px rgba(201, 146, 10, 0.25)",
        "gold-lg": "0 0 40px rgba(201, 146, 10, 0.30)",
        "muspel":  "0 0 20px rgba(201, 74, 10, 0.35)",
        "card-hover":
          "0 0 0 1px #2a2d45, 0 0 20px rgba(201, 146, 10, 0.18)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
