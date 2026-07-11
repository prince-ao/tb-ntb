import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        panel: "var(--panel)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        hair: { DEFAULT: "var(--hair)", 2: "var(--hair-2)" },
        alice: "var(--alice)",
        bob: "var(--bob)",
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "Iowan Old Style", "serif"],
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [animate],
};
