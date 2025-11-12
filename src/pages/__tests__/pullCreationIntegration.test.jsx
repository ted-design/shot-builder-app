import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { aggregatePullItems, createPullItemFromProduct } from "../../lib/pullItems";
import React from "react";

globalThis.React = React;

const addDocCalls = [];
const updateDocCalls = [];
let pendingAddDocError = null;

class FakeTimestamp {
  constructor(date) {
    this._date = date;
  }

  toDate() {
    return this._date;
  }

  static fromDate(date) {
    return new FakeTimestamp(date);
  }
}

const addDocMock = vi.fn(async (collectionRef, data) => {
  addDocCalls.push({ path: [...collectionRef.__path], data });
  if (pendingAddDocError) {
    const err = pendingAddDocError;
    pendingAddDocError = null;
    throw err;
  }
  const docId = `doc-${addDocCalls.length}`;
  return { id: docId, __path: [...collectionRef.__path, docId] };
});

const updateDocMock = vi.fn(async (docRef, data) => {
  updateDocCalls.push({ path: docRef.__path, data });
});

const collectionMock = vi.fn((...segments) => ({ __path: segments }));
const docMock = vi.fn((...segments) => ({ __path: segments }));

vi.mock("firebase/firestore", () => ({
  collection: collectionMock,
  doc: docMock,
  addDoc: addDocMock,
  updateDoc: updateDocMock,
  serverTimestamp: () => "__server_timestamp__",
  Timestamp: FakeTimestamp,
}));

beforeEach(() => {
  vi.clearAllMocks();
  addDocCalls.length = 0;
  updateDocCalls.length = 0;
  pendingAddDocError = null;
});

afterEach(() => {
  cleanup();
});

describe("Pull Creation Integration", () => {
  it("creates a pull with empty items array", async () => {
    const pullData = {
      name: "Spring Campaign Pull",
      projectId: "project-123",
      clientId: "unbound-merino",
      items: [],
      shotIds: [],
      status: "draft",
      createdBy: "test-user",
      createdAt: "__server_timestamp__",
    };

    await addDocMock(
      { __path: ["clients", "unbound-merino", "projects", "project-123", "pulls"] },
      pullData
    );

    expect(addDocCalls.length).toBe(1);
    expect(addDocCalls[0].path).toEqual([
      "clients",
      "unbound-merino",
      "projects",
      "project-123",
      "pulls",
    ]);
    expect(addDocCalls[0].data.name).toBe("Spring Campaign Pull");
    expect(addDocCalls[0].data.items).toEqual([]);
    expect(addDocCalls[0].data.shotIds).toEqual([]);
    expect(addDocCalls[0].data.status).toBe("draft");
  });

  it("adds items to a pull from shot products", async () => {
    const pullId = "pull-123";

    // Simulate products from shots
    const shotProducts = [
      {
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        styleNumber: "UB-001",
        colorName: "Navy",
        skuCode: "UB-001-NVY",
        sizes: ["S", "M", "L"],
      },
      {
        familyId: "fam-1",
        colourId: "col-2",
        styleName: "Merino Henley",
        styleNumber: "UB-001",
        colorName: "Grey",
        skuCode: "UB-001-GRY",
        sizes: ["M", "L", "XL"],
      },
    ];

    // Convert products to pull items
    const pullItems = shotProducts.map((product) => ({
      id: `item-${product.familyId}-${product.colourId}`,
      familyId: product.familyId,
      colourId: product.colourId,
      styleName: product.styleName,
      styleNumber: product.styleNumber,
      colorName: product.colorName,
      skuCode: product.skuCode,
      sizes: product.sizes.map((size) => ({
        size,
        quantity: 1,
        fulfilled: 0,
      })),
      fulfillmentStatus: "pending",
      shotIds: ["shot-1"],
    }));

    // Update the pull with items
    await updateDocMock(
      { __path: ["clients", "unbound-merino", "projects", "project-123", "pulls", pullId] },
      {
        items: pullItems,
        updatedAt: "__server_timestamp__",
      }
    );

    expect(updateDocCalls.length).toBe(1);
    expect(updateDocCalls[0].data.items).toHaveLength(2);
    expect(updateDocCalls[0].data.items[0].styleName).toBe("Merino Henley");
    expect(updateDocCalls[0].data.items[0].colorName).toBe("Navy");
    expect(updateDocCalls[0].data.items[0].sizes).toHaveLength(3);
    expect(updateDocCalls[0].data.items[1].colorName).toBe("Grey");
    expect(updateDocCalls[0].data.items[1].sizes).toHaveLength(3);
  });

  it("aggregates pull items with same family and color", () => {
    // Multiple items with same familyId and colourId but different sizes/quantities
    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [
          { size: "S", quantity: 2, fulfilled: 0 },
          { size: "M", quantity: 3, fulfilled: 0 },
        ],
        shotIds: ["shot-1"],
      },
      {
        id: "item-2",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [
          { size: "M", quantity: 1, fulfilled: 0 },
          { size: "L", quantity: 2, fulfilled: 0 },
        ],
        shotIds: ["shot-2"],
      },
    ];

    const aggregated = aggregatePullItems(items);

    // Should combine into one item
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].familyId).toBe("fam-1");
    expect(aggregated[0].colourId).toBe("col-1");

    // Should merge sizes and add quantities
    expect(aggregated[0].sizes).toHaveLength(3); // S, M, L
    const sizeM = aggregated[0].sizes.find((s) => s.size === "M");
    expect(sizeM.quantity).toBe(4); // 3 + 1

    // Should merge shot IDs
    expect(aggregated[0].shotIds).toContain("shot-1");
    expect(aggregated[0].shotIds).toContain("shot-2");
  });

  it("keeps separate items for different families or colors", () => {
    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [{ size: "M", quantity: 1, fulfilled: 0 }],
        shotIds: ["shot-1"],
      },
      {
        id: "item-2",
        familyId: "fam-1",
        colourId: "col-2",
        styleName: "Merino Henley",
        colorName: "Grey",
        sizes: [{ size: "M", quantity: 1, fulfilled: 0 }],
        shotIds: ["shot-1"],
      },
      {
        id: "item-3",
        familyId: "fam-2",
        colourId: "col-3",
        styleName: "Essential Hoodie",
        colorName: "Black",
        sizes: [{ size: "M", quantity: 1, fulfilled: 0 }],
        shotIds: ["shot-2"],
      },
    ];

    const aggregated = aggregatePullItems(items);

    // Should keep all three as separate items
    expect(aggregated).toHaveLength(3);
    expect(aggregated.map((item) => item.colorName).sort()).toEqual([
      "Black",
      "Grey",
      "Navy",
    ]);
  });

  it("updates fulfillment status of pull items", async () => {
    const pullId = "pull-456";

    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [
          { size: "S", quantity: 2, fulfilled: 0 },
          { size: "M", quantity: 3, fulfilled: 0 },
        ],
        fulfillmentStatus: "pending",
        shotIds: ["shot-1"],
      },
    ];

    // Simulate partial fulfillment
    const updatedItems = items.map((item) => ({
      ...item,
      sizes: item.sizes.map((size) =>
        size.size === "S"
          ? { ...size, fulfilled: 2 } // Fully fulfilled
          : { ...size, fulfilled: 1 } // Partially fulfilled
      ),
      fulfillmentStatus: "partial",
    }));

    await updateDocMock(
      { __path: ["clients", "unbound-merino", "projects", "project-123", "pulls", pullId] },
      {
        items: updatedItems,
        updatedAt: "__server_timestamp__",
      }
    );

    expect(updateDocCalls[0].data.items[0].fulfillmentStatus).toBe("partial");
    expect(updateDocCalls[0].data.items[0].sizes[0].fulfilled).toBe(2);
    expect(updateDocCalls[0].data.items[0].sizes[1].fulfilled).toBe(1);
  });

  it("marks items as complete when all sizes are fulfilled", async () => {
    const pullId = "pull-789";

    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [
          { size: "S", quantity: 2, fulfilled: 0 },
          { size: "M", quantity: 3, fulfilled: 0 },
        ],
        fulfillmentStatus: "pending",
        shotIds: ["shot-1"],
      },
    ];

    // Simulate full fulfillment
    const updatedItems = items.map((item) => ({
      ...item,
      sizes: item.sizes.map((size) => ({
        ...size,
        fulfilled: size.quantity, // All fulfilled
      })),
      fulfillmentStatus: "complete",
    }));

    await updateDocMock(
      { __path: ["clients", "unbound-merino", "projects", "project-123", "pulls", pullId] },
      {
        items: updatedItems,
        status: "complete",
        updatedAt: "__server_timestamp__",
      }
    );

    expect(updateDocCalls[0].data.items[0].fulfillmentStatus).toBe("complete");
    expect(updateDocCalls[0].data.items[0].sizes[0].fulfilled).toBe(2);
    expect(updateDocCalls[0].data.items[0].sizes[1].fulfilled).toBe(3);
    expect(updateDocCalls[0].data.status).toBe("complete");
  });

  it("handles multiple shots with overlapping products", async () => {
    // Shots with same products should aggregate
    const shot1Products = [
      {
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: ["S", "M"],
      },
    ];

    const shot2Products = [
      {
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: ["M", "L"],
      },
    ];

    // Convert to pull items
    const items = [
      ...shot1Products.map((product) => ({
        id: `shot1-${product.familyId}-${product.colourId}`,
        familyId: product.familyId,
        colourId: product.colourId,
        styleName: product.styleName,
        colorName: product.colorName,
        sizes: product.sizes.map((size) => ({ size, quantity: 1, fulfilled: 0 })),
        shotIds: ["shot-1"],
      })),
      ...shot2Products.map((product) => ({
        id: `shot2-${product.familyId}-${product.colourId}`,
        familyId: product.familyId,
        colourId: product.colourId,
        styleName: product.styleName,
        colorName: product.colorName,
        sizes: product.sizes.map((size) => ({ size, quantity: 1, fulfilled: 0 })),
        shotIds: ["shot-2"],
      })),
    ];

    const aggregated = aggregatePullItems(items);

    // Should combine into one item
    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].sizes).toHaveLength(3); // S, M, L

    // Size M should have quantity 2 (from both shots)
    const sizeM = aggregated[0].sizes.find((s) => s.size === "M");
    expect(sizeM.quantity).toBe(2);

    // Should track both shots
    expect(aggregated[0].shotIds).toContain("shot-1");
    expect(aggregated[0].shotIds).toContain("shot-2");
  });

  it("preserves notes when aggregating items", () => {
    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [{ size: "M", quantity: 1, fulfilled: 0 }],
        notes: "First note",
        shotIds: ["shot-1"],
      },
      {
        id: "item-2",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [{ size: "L", quantity: 1, fulfilled: 0 }],
        notes: "Second note",
        shotIds: ["shot-2"],
      },
    ];

    const aggregated = aggregatePullItems(items);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].notes).toBe("First note; Second note");
  });

  it("handles items without shot IDs gracefully", () => {
    const items = [
      {
        id: "item-1",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [{ size: "M", quantity: 1, fulfilled: 0 }],
        // No shotIds
      },
      {
        id: "item-2",
        familyId: "fam-1",
        colourId: "col-1",
        styleName: "Merino Henley",
        colorName: "Navy",
        sizes: [{ size: "L", quantity: 1, fulfilled: 0 }],
        shotIds: ["shot-1"],
      },
    ];

    const aggregated = aggregatePullItems(items);

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0].shotIds).toEqual(["shot-1"]);
  });
});
