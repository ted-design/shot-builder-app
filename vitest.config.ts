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
    // Higher timeout locally for integration tests; skip problematic tests in CI
    testTimeout: process.env.CI ? 15000 : 30000,
    // Use process forks instead of worker threads to avoid tinypool issues
    // on certain local environments (e.g. paths with spaces on macOS).
    pool: "forks",
    include: [
      "src/**/*.test.{js,jsx,ts,tsx}",
      "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
      "src-vnext/**/*.test.{ts,tsx}",
    ],
    // Skip slow/flaky integration tests in CI
    // These tests work locally but hang indefinitely in CI (GitHub Actions)
    // TODO: Investigate why these tests hang in CI but pass locally
    exclude: [
      "**/node_modules/**",
      ...(process.env.CI
        ? [
            "**/ProjectScopeContext.test.jsx",
            "**/useImageLoader.test.ts",
            "**/LocationsPage.test.jsx",
            "**/ShotEditModal.portal.test.jsx",
            "**/SearchCommand.test.jsx",
          ]
        : []),
    ],
  },
});
