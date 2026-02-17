import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

const normalizeBase = (value) => {
  if (!value) return "/";
  let base = value.trim();
  if (!base.startsWith("/")) base = `/${base}`;
  if (!base.endsWith("/")) base = `${base}/`;
  return base;
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = normalizeBase(env.VITE_BASE_PATH || "/");

  return {
    base,
    plugins: [
      react(),
      VitePWA({
        injectRegister: "auto",
        registerType: "autoUpdate",
        devOptions: {
          enabled: true,
          type: "module",
        },
        includeAssets: ["pwa.svg", "pwa-192.png", "pwa-512.png", "apple-touch-icon.png"],
        manifest: {
          name: "Okalab",
          short_name: "Okalab",
          description: "Plataforma de seminarios colaborativos",
          theme_color: "#0f172a",
          background_color: "#0f172a",
          display: "standalone",
          start_url: base,
          scope: base,
          icons: [
            {
              src: "pwa-192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
