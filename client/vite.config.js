import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/slot-booking-platform/", // Replace with your exact GitHub repo name
  server: {
    port: 3000,
    host: true,
  },
});
