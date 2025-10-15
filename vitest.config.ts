import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Increase timeout for async tests that may take longer in CI
    testTimeout: 15000,
    // Use process forks instead of worker threads to avoid tinypool issues
    // on certain local environments (e.g. paths with spaces on macOS).
    pool: "forks",
    include: [
      "src/**/*.test.{js,jsx,ts,tsx}",
      "src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    ],
  },
});
