import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const defaultResolver = async (source: unknown) => ({
  url: typeof source === "string" ? `https://cdn.test/${source}` : "https://cdn.test/image.jpg",
  ttl: 60_000,
  adapter: "firebase",
});

const resolveImageSourceMock = vi.fn(defaultResolver);

vi.mock("../../lib/storage/adapters", () => ({
  resolveImageSource: resolveImageSourceMock,
}));

vi.mock("../../lib/imageLoader", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../lib/imageLoader.js");
  return {
    ...actual,
    withRetry: async (fn: () => Promise<unknown>, { retries = 2 } = {}) => {
      let attempt = 0;
      let lastError: unknown = null;
      while (attempt <= retries) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          attempt += 1;
        }
      }
      throw lastError ?? new Error("retry failed");
    },
  };
});

let originalImage: typeof Image;

class ImmediateImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  decoding = "async";
  crossOrigin: string | null = null;
  private _src = "";

  decode() {
    return Promise.resolve();
  }

  set src(value: string) {
    this._src = value;
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }

  get src() {
    return this._src;
  }
}

beforeAll(() => {
  originalImage = global.Image;
  // @ts-expect-error override for tests
  global.Image = ImmediateImage;
});

afterEach(() => {
  resolveImageSourceMock.mockImplementation(defaultResolver);
  resolveImageSourceMock.mockClear();
});

afterAll(() => {
  global.Image = originalImage;
});

describe("useImageLoader", () => {
  it("resolves images and caches the result", async () => {
    const { useImageLoader, __imageCache } = await import("../useImageLoader");
    __imageCache.clear();

    const { result, unmount } = renderHook(() => useImageLoader("images/foo.jpg"));

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.url).toBe("https://cdn.test/images/foo.jpg");
    expect(resolveImageSourceMock).toHaveBeenCalledTimes(1);

    unmount();

    const second = renderHook(() => useImageLoader("images/foo.jpg"));
    expect(resolveImageSourceMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(second.result.current.status).toBe("loaded"));
    second.unmount();

    __imageCache.clear();
  });

  it("propagates errors when resolution fails", async () => {
    const { useImageLoader, __imageCache } = await import("../useImageLoader");
    __imageCache.clear();

    resolveImageSourceMock.mockImplementation(() => Promise.reject(new Error("boom")));

    const { result } = renderHook(() => useImageLoader("images/bad.jpg"));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.message).toContain("boom");

    __imageCache.clear();
  });
});
