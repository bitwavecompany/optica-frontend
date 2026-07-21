import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  assetsInclude: ["**/*.png", "**/*.jpg", "**/*.jpeg", "**/*.webp"],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: "esnext",
    assetsInlineLimit: 0,
  },
});