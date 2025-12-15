import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Ensure jsdom DOM is reset between tests to avoid cross-test leakage
// (multiple elements found, stale routers, etc.).
afterEach(() => cleanup());

// Test environment polyfills (jsdom)
// ResizeObserver is not implemented in jsdom; provide a minimal stub
// used by components relying on observer-driven layout effects.
//
// Note: This is test-only and does not affect runtime bundles.
// @ts-ignore
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
  observe() {}
  unobserve() {}
  disconnect() {}
}
  // @ts-ignore
  globalThis.ResizeObserver = ResizeObserver as unknown as typeof globalThis.ResizeObserver;
}

// Some tests assume scrollIntoView exists
// @ts-ignore
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
}

// matchMedia is not implemented in jsdom; provide a minimal stub so components
// relying on media queries (e.g. prefers-reduced-motion) can render in tests.
// @ts-ignore
if (typeof window !== "undefined" && typeof window.matchMedia === "undefined") {
  // @ts-ignore
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
