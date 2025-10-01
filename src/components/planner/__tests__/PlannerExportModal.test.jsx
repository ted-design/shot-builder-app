import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

const collectImagesMock = vi.fn();
const resolveImageSourceToDataUrlMock = vi.fn();

let prepareLanesForPdf;

vi.mock("../../../lib/pdfImageCollector", () => ({
  __esModule: true,
  collectImagesForPdf: collectImagesMock,
  resolveImageSourceToDataUrl: resolveImageSourceToDataUrlMock,
}));

beforeAll(async () => {
  ({ prepareLanesForPdf } = await import("../PlannerExportModal.jsx"));
});

beforeEach(async () => {
  document.body.innerHTML = "";
  collectImagesMock.mockReset();
  resolveImageSourceToDataUrlMock.mockReset();
  collectImagesMock.mockResolvedValue([]);
  resolveImageSourceToDataUrlMock.mockImplementation(async (source) => ({
    dataUrl: `data:image/png;base64,${Buffer.from(String(source)).toString("base64")}`,
    resolvedUrl: String(source),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
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

    expect(collectImagesMock).not.toHaveBeenCalled();
    expect(resolveImageSourceToDataUrlMock).not.toHaveBeenCalled();
    expect(prepared[0].shots[0].image).toBeNull();
    expect(prepared[0].shots[1].image).toBeNull();
  });

  it("preloads unique images and converts them to data URLs", async () => {
    document.body.innerHTML = `
      <div data-shot-id="shot-1"></div>
      <div data-shot-id="shot-2"></div>
    `;

    collectImagesMock.mockResolvedValue([
      {
        owner: { shotId: "shot-1" },
        dataUrl: "data:image/png;base64,AAA",
        resolvedUrl: "https://cdn.test/shared.png",
      },
    ]);

    resolveImageSourceToDataUrlMock.mockImplementation(async (source) => ({
      dataUrl: `data:image/png;base64,${Buffer.from(String(source)).toString("base64")}`,
      resolvedUrl: String(source),
    }));

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

    expect(collectImagesMock).toHaveBeenCalled();
    expect(resolveImageSourceToDataUrlMock).toHaveBeenCalled();
    expect(prepared[0].shots[0].image).toMatch(/^data:image/);
    expect(prepared[0].shots[1].image).toMatch(/^data:image/);
  });
});
