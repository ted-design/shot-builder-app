// Flat ESLint config for React + Vite project
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import importPlugin from "eslint-plugin-import";
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "functions/**",
      "src-vnext/ui/**",
      "coverage/**",
      "playwright-report/**",
      "archive/**",
      "**/*.d.ts",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        // Vitest globals
        describe: "readonly",
        it: "readonly",
        test: "readonly",
        expect: "readonly",
        vi: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        // Browser globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        console: "readonly",
      },
    },
    plugins: {
      react,
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
      import: importPlugin,
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // Relaxed baseline to keep CI green without massive refactors.
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-empty": "off",

      // React hooks: keep the important invariant enforced.
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",

      // Ensure JSX usage counts as variable usage for future tightening.
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "off",

      // Import ordering can be opinionated; leave off to avoid churn.
      "import/order": "off",

      // A11y: keep disabled for now to avoid large churn; we fixed easy wins manually.
      "jsx-a11y/aria-role": "off",
      "jsx-a11y/no-autofocus": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  {
    // Non-project TS files (tests/, scripts/, top-level config) —
    // plain parse, no type-aware linting.
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    // Type-aware linting is scoped to files included in tsconfig.json
    // (src-vnext/**). Other TS files fall through to the plain parser
    // block above without parserOptions.project.
    files: ["src-vnext/**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
    },
  },
  {
    // Test files commonly set up deliberate floating promises; disable
    // the rule so Phase 0.4 hardening focuses on production UI paths.
    // Scoped to src-vnext/** because that's where the rule is active.
    files: [
      "src-vnext/**/*.test.{ts,tsx}",
      "src-vnext/**/__tests__/**/*.{ts,tsx}",
    ],
    rules: {
      "@typescript-eslint/no-floating-promises": "off",
    },
  },
];
