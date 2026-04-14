import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { readStorage, writeStorage, removeStorage } from "../safeStorage";

const KEY = "__test_key__";

describe("safeStorage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fallback when the key is missing", () => {
    expect(readStorage(KEY, "fallback")).toBe("fallback");
  });

  it("persists values with writeStorage", () => {
    expect(writeStorage(KEY, "value")).toBe(true);
    expect(readStorage(KEY)).toBe("value");
  });

  it("removes values via removeStorage", () => {
    writeStorage(KEY, "value");
    expect(removeStorage(KEY)).toBe(true);
    expect(readStorage(KEY, "fallback")).toBe("fallback");
  });

  it("handles getItem errors gracefully", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(readStorage(KEY, "fallback")).toBe("fallback");
    expect(console.warn).toHaveBeenCalled();
  });

  it("handles setItem errors gracefully", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("boom");
    });
    expect(writeStorage(KEY, "value")).toBe(false);
    expect(console.warn).toHaveBeenCalled();
  });
});
