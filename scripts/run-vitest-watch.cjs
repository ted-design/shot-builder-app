#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const filteredArgs = process.argv
  .slice(2)
  .filter((arg) => arg !== "--" && arg !== "--runInBand");

const vitestBin = resolve(__dirname, "../node_modules/.bin/vitest");

const result = spawnSync(
  vitestBin,
  [
    "--watch",
    "--pool",
    "threads",
    "--poolOptions.threads.singleThread",
    ...filteredArgs,
  ],
  { stdio: "inherit" }
);

const exitCode =
  result.status === null && typeof result.signal === "string"
    ? 1
    : result.status ?? 1;

process.exit(exitCode);
