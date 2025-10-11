// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep existing code-splitting for large libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    // Report compressed size (gzip)
    reportCompressedSize: true,
    // Warn if main chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
  },
});
