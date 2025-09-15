import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure jsdom DOM is reset between tests to avoid cross-test leakage
// (multiple elements found, stale routers, etc.).
afterEach(() => cleanup());
