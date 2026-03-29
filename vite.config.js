// vite.config.js
import { defineConfig } from "vite";
import { execSync } from "child_process";
import { resolve } from "path";
import react from "@vitejs/plugin-react";

// Generate a build identifier: prefer git SHA, fall back to timestamp
function getBuildId() {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return `build-${Date.now()}`;
  }
}

const buildId = getBuildId();

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src-vnext"),
    },
  },
  server: {
    proxy: {
      "/api/": {
        target: process.env.VITE_FUNCTIONS_ORIGIN || "https://northamerica-northeast1-um-shotbuilder.cloudfunctions.net",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\//, "/"),
      },
    },
  },
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

          // PDF libraries - only loaded when exporting (defer large dependency).
          // @react-pdf/renderer and its internal sub-packages all use the @react-pdf scope.
          if (id.includes('react-pdf') || id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-lib';
          }

          // Transitive deps of @react-pdf/renderer that don't carry the react-pdf prefix.
          // Grouped separately so the pdf-lib chunk stays below 500 kB (pdf-lib itself is
          // already ~668 kB). Both chunks are only loaded on PDF export paths.
          if (
            id.includes('/fontkit/') ||
            id.includes('/yoga-layout/') ||
            id.includes('/crypto-js/') ||
            id.includes('/browserify-zlib/') ||
            id.includes('/vite-compatible-readable-stream/') ||
            id.includes('/jay-peg/') ||
            id.includes('/cross-fetch/') ||
            id.includes('/is-url/') ||
            id.includes('/emoji-regex/') ||
            id.includes('/queue/') ||
            id.includes('/pako/')
          ) {
            return 'pdf-deps';
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

          // React Router and Remix run-time - needed for every authenticated route
          if (
            id.includes('react-router') ||
            id.includes('@remix-run')
          ) {
            return 'router-vendor';
          }

          // Rich text / panel libraries - only loaded in ShotDetailPage / CallSheetBuilderPage
          if (id.includes('react-resizable-panels')) {
            return 'panels-vendor';
          }

          // Validation, sanitisation, and search utilities
          if (
            id.includes('/zod/') ||
            id.includes('/dompurify/') ||
            id.includes('/fuse.js/') ||
            id.includes('/fuse/')
          ) {
            return 'utils-vendor';
          }

          // UI utilities - toast, command palette, styling helpers
          if (
            id.includes('/sonner/') ||
            id.includes('/cmdk/') ||
            id.includes('class-variance-authority') ||
            id.includes('/tailwind-merge/') ||
            id.includes('/clsx/')
          ) {
            return 'ui-utils-vendor';
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
