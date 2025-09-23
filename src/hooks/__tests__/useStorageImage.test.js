import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/firebase", () => ({
  storage: {},
}));

vi.mock("firebase/storage", () => ({
  getDownloadURL: vi.fn(),
  ref: vi.fn(),
}));

const { buildSizedPath, resolveStoragePath } = await import("../useStorageImage.js");

describe("resolveStoragePath", () => {
  it("returns null for falsy values", () => {
    expect(resolveStoragePath(null)).toBeNull();
    expect(resolveStoragePath(undefined)).toBeNull();
  });

  it("returns string paths untouched", () => {
    expect(resolveStoragePath("images/foo.jpg")).toBe("images/foo.jpg");
  });

  it("prefers fullPath when provided on an object", () => {
    expect(resolveStoragePath({ fullPath: "images/bar.jpg" })).toBe("images/bar.jpg");
  });

  it("falls back to path when available", () => {
    expect(resolveStoragePath({ path: "images/baz.jpg" })).toBe("images/baz.jpg");
  });
});

describe("buildSizedPath", () => {
  it("returns the resolved path when sizing cannot be applied", () => {
    expect(buildSizedPath(null, 320)).toBeNull();
    expect(buildSizedPath("", 320)).toBe("");
  });

  it("keeps http urls untouched", () => {
    const url = "https://cdn.example.com/image.jpg";
    expect(buildSizedPath(url, 480)).toBe(url);
  });

  it("appends the requested dimensions to storage paths", () => {
    expect(buildSizedPath("images/foo.jpg", 320)).toBe("images/foo_320x400.jpg");
  });

  it("preserves query strings when adding the suffix", () => {
    expect(buildSizedPath("images/foo.jpg?alt=media", 200)).toBe("images/foo_200x250.jpg?alt=media");
  });

  it("avoids duplicating the suffix when already sized", () => {
    expect(buildSizedPath("images/foo_200x250.jpg", 200)).toBe("images/foo_200x250.jpg");
  });

  it("coerces objects with path metadata", () => {
    expect(buildSizedPath({ path: "images/foo.jpg" }, 120)).toBe("images/foo_120x150.jpg");
    expect(buildSizedPath({ fullPath: "images/bar.jpg" }, 180)).toBe("images/bar_180x225.jpg");
  });
});
