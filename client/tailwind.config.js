/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        evo: {
          bg: "#ffffff",
          sidebar: "#f7f8fc",
          card: "#f0f2fa",
          border: "#e0e4f0",
          text: "#2d3a6e",
          muted: "#8891b5",
          accent: "#4f6ef7",
          "accent-hover": "#3b5ae0",
          "user-bubble": "#4f6ef7",
          highlight: "#eef1ff",
          "highlight-text": "#4f6ef7",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
