import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Параметры Vite, адаптированные для разработки Tauri и применяемые только в `tauri dev` или `tauri build`
  //
  // 1. предотвратить скрытие ошибок rust от vite
  clearScreen: false,
  // 2. tauri ожидает фиксированный порт, зафиксировать этот порт
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
