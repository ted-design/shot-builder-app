#!/usr/bin/env node

/**
 * Vitest wrapper that forces --pool threads --singleThread on macOS local dev
 * (to avoid tinypool issues with paths containing spaces). On CI (Linux), the
 * vitest.config.ts pool settings are used as-is — no override needed.
 */

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const filteredArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--" && arg !== "--runInBand");

const vitestBin = resolve(__dirname, "../node_modules/.bin/vitest");

// On CI, let vitest.config.ts pool settings apply (forks). Locally on macOS,
// force threads+singleThread to work around paths-with-spaces tinypool bug.
const poolArgs = process.env.CI
  ? []
  : ["--pool", "threads", "--poolOptions.threads.singleThread"];

const result = spawnSync(
  vitestBin,
  ["run", ...poolArgs, ...filteredArgs],
  { stdio: "inherit" }
);

const exitCode =
  result.status === null && typeof result.signal === "string"
    ? 1
    : result.status ?? 1;

process.exit(exitCode);
