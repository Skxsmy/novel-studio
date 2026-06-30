import os from "node:os";
import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@tiptap") || id.includes("prosemirror")) return "editor-tiptap";
          if (id.includes("@codemirror") || id.includes("codemirror")) return "editor-codemirror";
          if (id.includes("react") || id.includes("react-dom")) return "react";
          return "vendor";
        },
      },
    },
  },
  cacheDir: path.join(os.tmpdir(), "novel-studio-vite-cache"),
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:4317",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
});
