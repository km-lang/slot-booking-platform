/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Etrigan-style re-skin: light neutral tints -> brand red -> near-black chrome.
        // 500 and below 900/950 are sampled directly from the Etrigan reference screenshots.
        emerald: {
          50: "#f7f5f5",
          100: "#efe6e5",
          200: "#dfcac8",
          300: "#c99e9a",
          400: "#bd6a63",
          500: "#b13b35", // brand red (sampled from "Etrigan 3.0" wordmark)
          600: "#96322c",
          700: "#7a2824",
          800: "#5c2622",
          900: "#515151", // chrome gray (sampled from LOGIN button)
          950: "#000000", // headings (sampled, pure black)
        },
        gem: {
          950: "#000000",
          900: "#515151",
          800: "#5c2622",
          accent: "#b13b35",
          light: "#c99e9a",
        },
      },
      animation: {
        "pulse-fast": "pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};
