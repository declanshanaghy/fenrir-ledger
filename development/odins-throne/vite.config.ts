import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  root: ".",
  // Vite looks for index.html at root — already placed there
  build: {
    outDir: "dist-ui",
    emptyOutDir: true,
  },
  server: {
    port: 3002,
    proxy: {
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
      "/api": {
        target: "http://localhost:3001",
      },
      "/healthz": {
        target: "http://localhost:3001",
      },
      "/static": {
        target: "http://localhost:3001",
      },
      "/auth": {
        target: "http://localhost:3001",
      },
    },
  },
});
