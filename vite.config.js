// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // CRITICAL: Check React FIRST before any other chunking logic
          // Exclude React and ReactDOM from ALL chunks so they stay in entry chunk
          // This ensures React is fully initialized before any components load
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return; // Return undefined to keep in entry chunk
          }

          // PDF libraries - only loaded when exporting (defer large dependency)
          if (id.includes('react-pdf') || id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-lib';
          }

          // Firebase - separate chunk (large and rarely updated)
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'firebase';
          }

          // UI component libraries - shared across pages
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'ui-vendor';
          }

          // Drag and drop library - only used in planner
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }

          // TanStack Query - data fetching library
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }

          // Other node_modules - catch-all vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    // Report compressed size (gzip)
    reportCompressedSize: true,
    // Warn if main chunk exceeds 500 kB
    chunkSizeWarningLimit: 500,
  },
  // Force React to be pre-bundled and included in optimization
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
});
