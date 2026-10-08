import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  /*
   * Env lives in apps/web/.env, not the repo root.
   *
   * Vite only reads VITE_* from its own envDir, and the default is the directory
   * holding this config. With the setting left off, every VITE_API_URL in the
   * root .env was silently ignored and the app quietly fell back to its
   * hard-coded default — which happened to be right on localhost and wrong
   * everywhere else. envDir is named explicitly so that fallback can never
   * happen by accident again.
   */
  envDir: fileURLToPath(new URL(".", import.meta.url)),
  server: {
    // Pinned rather than left to Vite's automatic port selection. A silent bump
    // to 5174 would not be in WEB_ORIGINS, and the app would fail with "Failed
    // to fetch" rather than saying why.
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 5173,
    strictPort: true,
  },
  plugins: [
    tailwindcss(),
    // SSR stays on. SPA mode was tried here and reverted: it prerenders an
    // empty shell and hands rendering to the client, which left the app blank
    // in dev and gave nothing to cache. Offline does not depend on it - the
    // service worker caches hashed assets and API reads, and the manifest plus
    // fetch handlers are what make the app installable.
    tanstackStart(),
    viteReact(),
  ],
});
