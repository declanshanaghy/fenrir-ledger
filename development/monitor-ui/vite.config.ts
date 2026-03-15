import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: false,
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
