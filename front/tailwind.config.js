/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        lumenjuris: {
          DEFAULT: "#354F99", // Couleur de LumenJuris
          dark: "#1a2d5a", // Couleur plus sombre, pour hover
          sidebar: "#1a1d23", // Couleur de fond de la sidebar
          background: "#F6F7F9", // Couleur de fond des pages
        },
        background: "oklch(1 0 0)",
        input: "oklch(0.922 0 0)",
        primary: "#354f99",
        muted_foreground: "oklch(0.556 0 0)",
        border: "oklch(0.922 0 0)",
        ring: "oklch(0.708 0 0)",
      },
    },
  },
  plugins: [],
};
