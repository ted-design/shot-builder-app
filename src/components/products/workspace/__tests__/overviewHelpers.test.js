import { describe, expect, it } from "vitest";
import {
  computeSampleMetrics,
  computeColorwayMetrics,
  computeAssetMetrics,
  computeActivityMetrics,
  SECTION_DESCRIPTIONS,
} from "../overviewHelpers";

describe("computeSampleMetrics", () => {
  it("returns zero metrics for empty samples array", () => {
    const result = computeSampleMetrics([]);
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns zero metrics when no argument is provided", () => {
    const result = computeSampleMetrics();
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns correct total count", () => {
    const samples = [
      { id: "1", status: "arrived" },
      { id: "2", status: "arrived" },
      { id: "3", status: "in_transit" },
    ];
    const result = computeSampleMetrics(samples);
    expect(result.total).toBe(3);
  });

  it("includes in_transit status in subMetrics with info variant", () => {
    const samples = [
      { id: "1", status: "in_transit" },
      { id: "2", status: "in_transit" },
    ];
    const result = computeSampleMetrics(samples);
    expect(result.subMetrics).toContainEqual({
      value: 2,
      label: "in transit",
      variant: "info",
    });
  });

  it("includes issue status in subMetrics with danger variant", () => {
    const samples = [{ id: "1", status: "issue" }];
    const result = computeSampleMetrics(samples);
    expect(result.subMetrics).toContainEqual({
      value: 1,
      label: "issues",
      variant: "danger",
    });
  });

  it("includes requested status in subMetrics with warning variant", () => {
    const samples = [
      { id: "1", status: "requested" },
      { id: "2", status: "requested" },
      { id: "3", status: "requested" },
    ];
    const result = computeSampleMetrics(samples);
    expect(result.subMetrics).toContainEqual({
      value: 3,
      label: "requested",
      variant: "warning",
    });
  });

  it("includes arrived status in subMetrics with success variant", () => {
    const samples = [{ id: "1", status: "arrived" }];
    const result = computeSampleMetrics(samples);
    expect(result.subMetrics).toContainEqual({
      value: 1,
      label: "arrived",
      variant: "success",
    });
  });

  it("handles multiple statuses in correct priority order", () => {
    const samples = [
      { id: "1", status: "in_transit" },
      { id: "2", status: "issue" },
      { id: "3", status: "requested" },
      { id: "4", status: "arrived" },
    ];
    const result = computeSampleMetrics(samples);

    // Verify order: in_transit, issue, requested, arrived
    expect(result.subMetrics[0].label).toBe("in transit");
    expect(result.subMetrics[1].label).toBe("issues");
    expect(result.subMetrics[2].label).toBe("requested");
    expect(result.subMetrics[3].label).toBe("arrived");
  });

  it("ignores unknown statuses", () => {
    const samples = [
      { id: "1", status: "unknown_status" },
      { id: "2", status: "arrived" },
    ];
    const result = computeSampleMetrics(samples);
    expect(result.total).toBe(2);
    expect(result.subMetrics).toHaveLength(1);
    expect(result.subMetrics[0].label).toBe("arrived");
  });
});

describe("computeColorwayMetrics", () => {
  it("returns zero metrics for empty skus array", () => {
    const result = computeColorwayMetrics([]);
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns zero metrics when no argument is provided", () => {
    const result = computeColorwayMetrics();
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns correct total count", () => {
    const skus = [
      { id: "1", colorName: "Black" },
      { id: "2", colorName: "White" },
    ];
    const result = computeColorwayMetrics(skus);
    expect(result.total).toBe(2);
  });

  it("counts unique colors when less than total", () => {
    const skus = [
      { id: "1", colorName: "Black" },
      { id: "2", colorName: "Black" },
      { id: "3", colorName: "White" },
    ];
    const result = computeColorwayMetrics(skus);
    expect(result.subMetrics).toContainEqual({
      value: 2,
      label: "unique",
      variant: "default",
    });
  });

  it("does not show unique count when all are unique", () => {
    const skus = [
      { id: "1", colorName: "Black" },
      { id: "2", colorName: "White" },
    ];
    const result = computeColorwayMetrics(skus);
    const uniqueMetric = result.subMetrics.find((m) => m.label === "unique");
    expect(uniqueMetric).toBeUndefined();
  });

  it("counts skus with images using imagePath", () => {
    const skus = [
      { id: "1", colorName: "Black", imagePath: "/images/black.jpg" },
      { id: "2", colorName: "White" },
    ];
    const result = computeColorwayMetrics(skus);
    expect(result.subMetrics).toContainEqual({
      value: 1,
      label: "with photos",
      variant: "success",
    });
  });

  it("counts skus with images using thumbnailImagePath", () => {
    const skus = [
      { id: "1", colorName: "Black", thumbnailImagePath: "/thumb/black.jpg" },
    ];
    const result = computeColorwayMetrics(skus);
    expect(result.subMetrics).toContainEqual({
      value: 1,
      label: "with photos",
      variant: "success",
    });
  });

  it("uses color field as fallback for colorName", () => {
    const skus = [
      { id: "1", color: "Red" },
      { id: "2", color: "Blue" },
    ];
    const result = computeColorwayMetrics(skus);
    expect(result.total).toBe(2);
  });

  it("treats missing color names as Unknown", () => {
    const skus = [{ id: "1" }, { id: "2" }];
    const result = computeColorwayMetrics(skus);
    // Both are "Unknown", so unique count (1) is different from total (2)
    expect(result.subMetrics).toContainEqual({
      value: 1,
      label: "unique",
      variant: "default",
    });
  });
});

describe("computeAssetMetrics", () => {
  it("returns zero metrics when family has no images and skus is empty", () => {
    const result = computeAssetMetrics({}, []);
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns zero metrics when no arguments are provided", () => {
    const result = computeAssetMetrics();
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("counts family headerImagePath", () => {
    const family = { headerImagePath: "/images/header.jpg" };
    const result = computeAssetMetrics(family, []);
    expect(result.total).toBe(1);
    expect(result.subMetrics).toContainEqual({ value: 1, label: "images", variant: "default" });
  });

  it("counts family thumbnailImagePath when different from header", () => {
    const family = {
      headerImagePath: "/images/header.jpg",
      thumbnailImagePath: "/images/thumb.jpg",
    };
    const result = computeAssetMetrics(family, []);
    expect(result.total).toBe(2);
  });

  it("does not double-count when thumbnail equals header", () => {
    const family = {
      headerImagePath: "/images/same.jpg",
      thumbnailImagePath: "/images/same.jpg",
    };
    const result = computeAssetMetrics(family, []);
    expect(result.total).toBe(1);
  });

  it("counts SKU colorway images", () => {
    const skus = [
      { id: "1", imagePath: "/images/sku1.jpg" },
      { id: "2", imagePath: "/images/sku2.jpg" },
      { id: "3" }, // no image
    ];
    const result = computeAssetMetrics({}, skus);
    expect(result.total).toBe(2);
  });

  it("combines family and SKU image counts", () => {
    const family = { headerImagePath: "/images/header.jpg" };
    const skus = [
      { id: "1", imagePath: "/images/sku1.jpg" },
      { id: "2", imagePath: "/images/sku2.jpg" },
    ];
    const result = computeAssetMetrics(family, skus);
    expect(result.total).toBe(3);
  });
});

describe("computeActivityMetrics", () => {
  it("returns zero metrics when family has no timestamps", () => {
    const result = computeActivityMetrics({});
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("returns zero metrics when no argument is provided", () => {
    const result = computeActivityMetrics();
    expect(result.total).toBe(0);
    expect(result.subMetrics).toEqual([]);
  });

  it("counts creation event when createdAt exists", () => {
    const family = { createdAt: new Date("2024-01-01") };
    const result = computeActivityMetrics(family);
    expect(result.total).toBe(1);
  });

  it("counts update event when updatedAt is > 60 seconds after createdAt", () => {
    const createdAt = new Date("2024-01-01T12:00:00");
    const updatedAt = new Date("2024-01-01T12:02:00"); // 2 minutes later
    const family = { createdAt, updatedAt };
    const result = computeActivityMetrics(family);
    expect(result.total).toBe(2); // creation + update
    expect(result.subMetrics).toContainEqual({ value: 1, label: "recent", variant: "info" });
  });

  it("does not count update when within 60 seconds of creation", () => {
    const createdAt = new Date("2024-01-01T12:00:00");
    const updatedAt = new Date("2024-01-01T12:00:30"); // 30 seconds later
    const family = { createdAt, updatedAt };
    const result = computeActivityMetrics(family);
    expect(result.total).toBe(1); // only creation
    expect(result.subMetrics).toEqual([]);
  });

  it("handles Firestore timestamp-like objects with toDate()", () => {
    const createdAt = { toDate: () => new Date("2024-01-01T12:00:00") };
    const updatedAt = { toDate: () => new Date("2024-01-01T12:05:00") };
    const family = { createdAt, updatedAt };
    const result = computeActivityMetrics(family);
    expect(result.total).toBe(2);
  });
});

describe("SECTION_DESCRIPTIONS", () => {
  it("has descriptions for all sections", () => {
    expect(SECTION_DESCRIPTIONS.colorways).toBeDefined();
    expect(SECTION_DESCRIPTIONS.samples).toBeDefined();
    expect(SECTION_DESCRIPTIONS.assets).toBeDefined();
    expect(SECTION_DESCRIPTIONS.activity).toBeDefined();
  });

  it("descriptions are non-empty strings", () => {
    expect(typeof SECTION_DESCRIPTIONS.colorways).toBe("string");
    expect(SECTION_DESCRIPTIONS.colorways.length).toBeGreaterThan(0);
    expect(typeof SECTION_DESCRIPTIONS.samples).toBe("string");
    expect(SECTION_DESCRIPTIONS.samples.length).toBeGreaterThan(0);
  });
});
