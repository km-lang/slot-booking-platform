/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Soft Sky & Slate" theme: light cool-toned neutrals -> muted slate blue -> slate charcoal.
        emerald: {
          50: "#eff3f6",
          100: "#dce6ec",
          200: "#a8c3d1", // powder blue accent
          300: "#8fb0c2",
          400: "#739cb3",
          500: "#5b7c99", // primary (muted slate blue)
          600: "#4d6883",
          700: "#3f5469",
          800: "#34465a",
          900: "#2e3a46", // slate charcoal (headings)
          950: "#1c242c", // deepest slate (near-black, never pure black)
        },
        gem: {
          950: "#1c242c",
          900: "#2e3a46",
          800: "#34465a",
          accent: "#5b7c99",
          light: "#a8c3d1",
        },
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
