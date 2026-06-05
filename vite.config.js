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
          // CHUNKING STRATEGY (correctness over granularity):
          //
          // React core and ALL of its eager consumers (router, radix, lucide,
          // zod, etc.) live together in a single `vendor` chunk. Rollup orders
          // modules WITHIN a chunk by dependency, so React initializes before
          // anything that uses it. Splitting React (or its eager consumers) into
          // separate manual chunks creates cross-chunk init-order hazards — and,
          // as seen here, circular chunk edges (`vendor <-> react-vendor`) — that
          // leave React's CJS namespace undefined when `exports.Children = …`
          // runs. That surfaced in production as a white screen with
          // "Cannot set properties of undefined (setting 'Children')" and broke
          // the Playwright `ui-checks` job for months. One eager vendor chunk is
          // acyclic by construction.
          //
          // Only genuinely LAZY or very heavy dependencies are split out below.
          // Each of these only ever imports INTO `vendor` (never the reverse),
          // so the chunk graph stays a DAG.

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

          // Firebase - separate chunk (large and rarely updated). Does not import React.
          if (id.includes('firebase') || id.includes('@firebase')) {
            return 'firebase';
          }

          // Drag and drop library - only used in planner (lazy route).
          if (id.includes('@dnd-kit')) {
            return 'dnd';
          }

          // Rich text / panel libraries - only loaded in ShotDetailPage / CallSheetBuilderPage (lazy).
          if (id.includes('react-resizable-panels')) {
            return 'panels-vendor';
          }

          // Everything else from node_modules — including React and all its eager
          // consumers — shares ONE acyclic vendor chunk.
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
