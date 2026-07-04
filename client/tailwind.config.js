/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Forest & Brass" theme: warm ivory -> muted sage -> deep forest green, with a brass gold accent.
        emerald: {
          50: "#faf6ed",
          100: "#f3efe1",
          200: "#e3dcc7",
          300: "#c7d3cb",
          400: "#9fb2a7",
          500: "#5c7c6a", // primary (forest sage)
          600: "#45614f",
          700: "#3b463f",
          800: "#24312b",
          900: "#12332b", // deep forest green (headings)
          950: "#0b211b", // deepest forest (near-black, never pure black)
        },
        gem: {
          950: "#0b211b",
          900: "#12332b",
          800: "#24312b",
          accent: "#c9a24b", // brass gold
          light: "#f3ecd8",
        },
      },
      fontFamily: {
        display: ["Fraunces", "ui-serif", "serif"],
      },
      boxShadow: {
        elevated: "0 4px 20px -4px rgba(18, 51, 43, 0.12)",
      },
      backdropBlur: {
        glass: "24px",
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
