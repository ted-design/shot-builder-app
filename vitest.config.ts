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
    include: [
      "src/**/*.test.{js,jsx,ts,tsx}",
      "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
      "src-vnext/**/*.test.{ts,tsx}",
    ],
    // Skip slow/flaky integration tests in CI
    // These tests have historically been flaky in CI; keep excluded until fixed.
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
