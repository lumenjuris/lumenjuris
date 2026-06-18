/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Marque ──────────────────────────────────────
        brand: {
          DEFAULT: "#2C3A5E",
          hover:   "#24304d",
          active:  "#1a2238",
          light:   "#eef1fa",
          muted:   "#c7d0ef",
        },
        // ── Sidebar (fond sombre) ────────────────────────
        sidebar: {
          DEFAULT: "#111318",
          hover:   "#1c2030",
          active:  "#232843",
          border:  "rgba(255,255,255,0.06)",
        },
        // ── Surfaces ─────────────────────────────────────
        surface: {
          DEFAULT: "#ffffff",
          subtle:  "#f4f6fa",
          muted:   "#eaecf2",
        },
        // ── Bordures ─────────────────────────────────────
        line: {
          DEFAULT:  "#e5e7eb",
          subtle:   "#f1f3f7",
          emphasis: "#d1d5db",
        },
        // ── Texte / Encre ─────────────────────────────────
        ink: {
          DEFAULT:     "#111827",
          secondary:   "#374151",
          muted:       "#6b7280",
          subtle:      "#9ca3af",
          placeholder: "#d1d5db",
          inverse:     "#ffffff",
        },
        // ── Sémantiques ───────────────────────────────────
        success: { light: "#d1fae5", DEFAULT: "#059669", dark: "#065f46" },
        warning: { light: "#fef3c7", DEFAULT: "#d97706", dark: "#92400e" },
        danger:  { light: "#fee2e2", DEFAULT: "#dc2626", dark: "#991b1b" },
        info:    { light: "#dbeafe", DEFAULT: "#2563eb", dark: "#1e40af" },
        // ── Rétro-compatibilité (composants existants) ────
        lumenjuris: {
          DEFAULT:    "#2C3A5E",
          dark:       "#1a2238",
          sidebar:    "#111318",
          background: "#f4f6fa",
        },
        // ── shadcn / Base UI ──────────────────────────────
        background:       "oklch(1 0 0)",
        input:            "oklch(0.922 0 0)",
        primary:          "#2C3A5E",
        muted_foreground: "oklch(0.556 0 0)",
        border:           "oklch(0.922 0 0)",
        ring:             "oklch(0.708 0 0)",
        destructive:      "oklch(0.577 0.245 27.325)",
      },
      borderRadius: {
        card:  "1rem",    // 16px — cartes
        panel: "0.75rem", // 12px — panneaux internes
        chip:  "6px",     // 6px  — badges compacts
      },
      boxShadow: {
        card:       "0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-md":  "0 4px 12px 0 rgb(0 0 0 / 0.08)",
        panel:      "0 0 0 1px rgb(0 0 0 / 0.05), 0 2px 8px 0 rgb(0 0 0 / 0.06)",
        "ring-brand": "0 0 0 3px rgb(53 79 153 / 0.15)",
      },
      fontFamily: {
        sans: ['"Inter Variable"', "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }], // 10px
      },
    },
  },
  plugins: [],
};
