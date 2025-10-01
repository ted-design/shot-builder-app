import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const originalFetch = global.fetch;
const OriginalFileReader = global.FileReader;

let prepareLanesForPdf;
let fetchMock;

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  global.fetch = fetchMock;

  class MockFileReader {
    constructor() {
      this.result = null;
      this.onloadend = null;
      this.onerror = null;
    }

    readAsDataURL() {
      this.result = "data:image/png;base64,MOCK";
      if (typeof this.onloadend === "function") {
        this.onloadend();
      }
    }
  }

  global.FileReader = MockFileReader;

  ({ prepareLanesForPdf } = await import("../PlannerExportModal.jsx"));
});

afterEach(() => {
  if (originalFetch) {
    global.fetch = originalFetch;
  } else {
    delete global.fetch;
  }
  if (OriginalFileReader) {
    global.FileReader = OriginalFileReader;
  } else {
    delete global.FileReader;
  }
  vi.restoreAllMocks();
});

describe("prepareLanesForPdf", () => {
  it("skips image preloading when images are excluded", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          { id: "shot-1", image: "https://cdn.test/one.png" },
          { id: "shot-2", image: null },
        ],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: false });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(prepared[0].shots[0].image).toBeNull();
    expect(prepared[0].shots[1].image).toBeNull();
  });

  it("preloads unique images and converts them to data URLs", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["image"], { type: "image/png" })),
    });

    const lanes = [
      {
        id: "lane-a",
        shots: [
          { id: "shot-1", image: "https://cdn.test/shared.png" },
          { id: "shot-2", image: "https://cdn.test/shared.png" },
        ],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(prepared[0].shots[0].image).toMatch(/^data:image/);
    expect(prepared[0].shots[1].image).toMatch(/^data:image/);
  });
});
