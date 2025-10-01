import { describe, expect, it, vi } from "vitest";

const getDownloadURLMock = vi.fn(async (ref: { _path: string }) => {
  if (ref._path.includes("_200x250")) {
    throw new Error("missing sized variant");
  }
  return `https://firebase.test/${ref._path}`;
});

vi.mock("firebase/storage", () => ({
  getDownloadURL: getDownloadURLMock,
  ref: (_storage: unknown, path: string) => ({ _path: path }),
}));

vi.mock("../../firebase", () => ({
  storage: {},
}));

beforeEach(() => {
  getDownloadURLMock.mockClear();
});

describe("resolveImageSource", () => {
  it("falls back to the original path when the sized variant is unavailable", async () => {
    const { resolveImageSource } = await import("../adapters.ts");

    const result = await resolveImageSource("images/foo.jpg", { preferredSize: 200 });

    expect(result.url).toBe("https://firebase.test/images/foo.jpg");
    expect(getDownloadURLMock).toHaveBeenCalledTimes(2);
    expect(getDownloadURLMock.mock.calls[0][0]).toEqual({ _path: "images/foo_200x250.jpg" });
    expect(getDownloadURLMock.mock.calls[1][0]).toEqual({ _path: "images/foo.jpg" });
  });

  it("returns passthrough URLs untouched", async () => {
    const { resolveImageSource } = await import("../adapters.ts");

    const result = await resolveImageSource("https://cdn.example.com/image.jpg");

    expect(result.url).toBe("https://cdn.example.com/image.jpg");
    expect(getDownloadURLMock).not.toHaveBeenCalled();
  });
});
