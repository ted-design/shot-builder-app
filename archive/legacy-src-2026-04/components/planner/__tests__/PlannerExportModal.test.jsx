import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from "vitest";

const collectImagesMock = vi.fn();
const resolveImageSourceToDataUrlMock = vi.fn();
const processImageForPDFMock = vi.fn();
const getOptimalImageDimensionsMock = vi.fn();

let prepareLanesForPdf;

vi.mock("../../../lib/pdfImageCollector", () => ({
  __esModule: true,
  collectImagesForPdf: collectImagesMock,
  resolveImageSourceToDataUrl: resolveImageSourceToDataUrlMock,
}));

vi.mock("../../../lib/pdfImageProcessor", () => ({
  __esModule: true,
  processImageForPDF: processImageForPDFMock,
  getOptimalImageDimensions: getOptimalImageDimensionsMock,
}));

beforeAll(async () => {
  ({ prepareLanesForPdf } = await import("../PlannerExportModal.jsx"));
});

beforeEach(async () => {
  document.body.innerHTML = "";
  collectImagesMock.mockReset();
  resolveImageSourceToDataUrlMock.mockReset();
  processImageForPDFMock.mockReset();
  getOptimalImageDimensionsMock.mockReset();

  collectImagesMock.mockResolvedValue([]);
  resolveImageSourceToDataUrlMock.mockImplementation(async (source) => ({
    dataUrl: `data:image/png;base64,${Buffer.from(String(source)).toString("base64")}`,
    resolvedUrl: String(source),
  }));
  processImageForPDFMock.mockImplementation(async (dataUrl) => dataUrl);
  getOptimalImageDimensionsMock.mockReturnValue({ width: 200, height: 150 });
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

    const prepared = await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true });

    // Should fetch images directly via resolveImageSourceToDataUrl (not DOM capture)
    expect(resolveImageSourceToDataUrlMock).toHaveBeenCalled();
    expect(prepared[0].shots[0].image).toMatch(/^data:image/);
    expect(prepared[0].shots[1].image).toMatch(/^data:image/);
  }, 30000);

  it("preserves shot numbers and other metadata", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          {
            id: "shot-1",
            shotNumber: "Scene 5A",
            name: "Catalog hero",
          },
        ],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: false });

    expect(prepared[0].shots[0].shotNumber).toBe("Scene 5A");
    expect(prepared[0].shots[0].name).toBe("Catalog hero");
  });

  it("handles lanes with no shots", async () => {
    const lanes = [
      {
        id: "lane-empty",
        name: "Empty Lane",
        shots: [],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: false });

    expect(prepared[0].shots).toEqual([]);
    expect(prepared[0].id).toBe("lane-empty");
  });

  it("handles multiple lanes with mixed content", async () => {
    const lanes = [
      {
        id: "lane-1",
        shots: [
          { id: "shot-1", name: "Shot 1" },
          { id: "shot-2", name: "Shot 2" },
        ],
      },
      {
        id: "lane-2",
        shots: [],
      },
      {
        id: "lane-3",
        shots: [
          { id: "shot-3", name: "Shot 3" },
        ],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: false });

    expect(prepared).toHaveLength(3);
    expect(prepared[0].shots).toHaveLength(2);
    expect(prepared[1].shots).toHaveLength(0);
    expect(prepared[2].shots).toHaveLength(1);
  });

  it("passes density to image dimension calculation", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [{ id: "shot-1", image: "https://example.com/image.jpg" }],
      },
    ];

    resolveImageSourceToDataUrlMock.mockResolvedValue({
      dataUrl: "data:image/png;base64,TEST",
    });

    await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true, density: 'detailed' });

    expect(getOptimalImageDimensionsMock).toHaveBeenCalledWith('detailed');
  });

  it("handles shots with attachments and crop data", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          {
            id: "shot-1",
            attachments: [
              { id: 'att-1', isPrimary: true, cropData: { x: 75, y: 25 } },
            ],
            image: "https://example.com/image.jpg",
          },
        ],
      },
    ];

    resolveImageSourceToDataUrlMock.mockResolvedValue({
      dataUrl: "data:image/png;base64,TEST",
    });

    const prepared = await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true });

    // Should have called processImageForPDF with crop position
    expect(processImageForPDFMock).toHaveBeenCalled();
  });

  it("fetches images directly from URLs", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          { id: "shot-1", image: "https://example.com/fallback.jpg" },
        ],
      },
    ];

    // resolveImageSourceToDataUrl fetches images directly
    resolveImageSourceToDataUrlMock.mockResolvedValue({
      dataUrl: "data:image/png;base64,FALLBACK",
    });

    const prepared = await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true });

    expect(resolveImageSourceToDataUrlMock).toHaveBeenCalledWith("https://example.com/fallback.jpg");
    expect(prepared[0].shots[0].image).toBe("data:image/png;base64,FALLBACK");
  });

  it("gracefully handles image processing errors", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          { id: "shot-1", image: "https://example.com/bad-image.jpg" },
        ],
      },
    ];

    resolveImageSourceToDataUrlMock.mockRejectedValue(new Error("Image load failed"));

    const prepared = await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true });

    // Should set image to null on error
    expect(prepared[0].shots[0].image).toBeNull();
  });

  it("handles null or undefined lanes array", async () => {
    const prepared1 = await prepareLanesForPdf(null, { includeImages: false });
    const prepared2 = await prepareLanesForPdf(undefined, { includeImages: false });

    expect(prepared1).toEqual([]);
    expect(prepared2).toEqual([]);
  });

  it("preserves all shot metadata through processing", async () => {
    const lanes = [
      {
        id: "lane-a",
        name: "Test Lane",
        shots: [
          {
            id: "shot-1",
            shotNumber: "001",
            name: "Hero Shot",
            type: "On-Figure",
            date: "2025-01-15",
            location: "Studio A",
            talent: ["Model 1", "Model 2"],
            products: ["Product A"],
            notes: "Special lighting",
            customField: "custom value",
          },
        ],
      },
    ];

    const prepared = await prepareLanesForPdf(lanes, { includeImages: false });

    const shot = prepared[0].shots[0];
    expect(shot.id).toBe("shot-1");
    expect(shot.shotNumber).toBe("001");
    expect(shot.name).toBe("Hero Shot");
    expect(shot.type).toBe("On-Figure");
    expect(shot.date).toBe("2025-01-15");
    expect(shot.location).toBe("Studio A");
    expect(shot.talent).toEqual(["Model 1", "Model 2"]);
    expect(shot.products).toEqual(["Product A"]);
    expect(shot.notes).toBe("Special lighting");
    expect(shot.customField).toBe("custom value");
  });

  it("processes images with referenceImageCrop fallback", async () => {
    const lanes = [
      {
        id: "lane-a",
        shots: [
          {
            id: "shot-1",
            referenceImageCrop: { x: 60, y: 40 },
            image: "https://example.com/image.jpg",
          },
        ],
      },
    ];

    resolveImageSourceToDataUrlMock.mockResolvedValue({
      dataUrl: "data:image/png;base64,TEST",
    });

    await prepareLanesForPdf(lanes, { includeImages: true, inlineImages: true });

    // Should have used referenceImageCrop for cropping
    expect(processImageForPDFMock).toHaveBeenCalled();
    const cropArgs = processImageForPDFMock.mock.calls[0][1];
    expect(cropArgs.cropPosition).toEqual({ x: 60, y: 40 });
  });
});
