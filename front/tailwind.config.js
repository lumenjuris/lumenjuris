/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lumenjuris: {
          DEFAULT: "#354F99", // Couleur de LumenJuris
          dark:    "#1a2d5a", // Couleur plus sombre, pour hover 
          sidebar: "#1a1d23", // Couleur de fond de la sidebar
        },
      },
    },
  },
  plugins: [],
};
