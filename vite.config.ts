/// <reference types="vitest/config" />
import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

// Tauri sets this when developing against a mobile device / LAN host.
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/ — options tuned for Tauri (see tauri.app/start/frontend/vite).
export default defineConfig({
  plugins: [svelte(), svelteTesting(), tailwindcss()],
  resolve: {
    alias: { $lib: fileURLToPath(new URL("./src/lib", import.meta.url)) },
  },
  // 1. Don't let Vite clobber Rust compiler errors in the terminal.
  clearScreen: false,
  server: {
    // 2. Tauri needs a fixed port; fail loudly if taken.
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    // 3. Rust is watched by cargo, not Vite.
    watch: { ignored: ["**/src-tauri/**"] },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest-setup.ts"],
  },
});
