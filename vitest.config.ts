import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "src-vnext"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // CI runners are slower than local dev machines. Use a higher timeout in CI
    // to avoid false negatives from integration-heavy component tests.
    testTimeout: process.env.CI ? 30000 : 15000,
    hookTimeout: process.env.CI ? 30000 : 15000,
    // Use process forks instead of worker threads to avoid tinypool issues
    // on certain local environments (e.g. paths with spaces on macOS).
    pool: "forks",
    // Only include src-vnext tests. Legacy src/ tests are excluded because
    // src/ is read-only reference code that is not built by vite and its
    // banned legacy deps (react-select, react-easy-crop, reactjs-tiptap-editor,
    // @tanstack/react-query) have been removed from package.json.
    include: ["src-vnext/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**"],
  },
});
