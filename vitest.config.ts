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
    // Auto-restore every `vi.stubGlobal` / `vi.stubEnv` before each test.
    // Without this, a test that stubs a global in a `beforeEach` and never
    // unstubs (e.g. `vi.stubGlobal("localStorage", {...})` in useExportTemplates
    // / documentPersistence) leaks the stub into later files that share a
    // worker. The committed pool is `forks` (below) — one process per file — so
    // CI never saw it. But the local dev wrapper (scripts/run-vitest.cjs) forces
    // `--pool threads --singleThread`, where all files share ONE jsdom global:
    // the leaked stub left `window.localStorage` a plain object whose prototype
    // has no `setItem`, so ViewAsPreviewProvider's
    // `vi.spyOn(localStorage.__proto__, "setItem")` threw "setItem does not
    // exist" (6 false local-only failures). Restoring stubs before each test
    // makes the suite correct under ANY pool and kills the whole class. (Both
    // flags set for symmetry: every stubGlobal/stubEnv usage today is per-test.)
    unstubGlobals: true,
    unstubEnvs: true,
    // CI runners (GitHub free-tier) are significantly slower than local dev
    // machines. 60s prevents false negatives from integration-heavy component
    // tests (AdminPage, InviteUserDialog, LibraryTalentPage, etc.).
    testTimeout: process.env.CI ? 60000 : 15000,
    hookTimeout: process.env.CI ? 60000 : 15000,
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
