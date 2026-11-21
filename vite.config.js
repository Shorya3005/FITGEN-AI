
import { defineConfig } from "vite";

export default defineConfig({
  root: "public",
  publicDir: false,

  server: {
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  },

  preview: {
    host: "0.0.0.0"
  },

  build: {
    outDir: "../dist",
    emptyOutDir: true
  }
});
