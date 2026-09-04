import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflare(),
  integrations: [react()],
  output: "server",
  server: {
    port: 8788,
  },
  vite: {
    plugins: tailwindcss(),
  },
});