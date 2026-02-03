import { describe, expect, it } from "vitest";
import { getShotAssignedProductsCount } from "../shotAssignedProducts";

describe("getShotAssignedProductsCount", () => {
  it("counts union of shot.products and look products (deduped)", () => {
    const shot = {
      products: [
        { familyId: "f1", colourId: "c1", sizeScope: "single", size: "S" },
        { familyId: "f1", colourId: "c1", sizeScope: "single", size: "S" }, // dup
      ],
      looks: [
        { products: [{ familyId: "f1", colourId: "c1", sizeScope: "single", size: "S" }] }, // dup
        { products: [{ familyId: "f1", colourId: "c1", sizeScope: "all", size: null }] }, // distinct
      ],
    };

    expect(getShotAssignedProductsCount(shot)).toBe(2);
  });

  it("falls back to shot.productIds only when there are no product objects", () => {
    const shot = {
      productIds: ["f1", "f2", "f2"],
    };

    expect(getShotAssignedProductsCount(shot)).toBe(2);
  });

  it("ignores invalid entries safely", () => {
    expect(getShotAssignedProductsCount(null)).toBe(0);
    expect(getShotAssignedProductsCount({ products: [null, "x", {}] })).toBe(0);
  });
});

