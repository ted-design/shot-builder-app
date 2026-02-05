import { describe, expect, test } from "vitest";

import { extractShotProductsForPull } from "../shotProductsForPull";

describe("extractShotProductsForPull", () => {
  test("returns empty array for non-object inputs", () => {
    expect(extractShotProductsForPull(null)).toEqual([]);
    expect(extractShotProductsForPull(undefined)).toEqual([]);
    expect(extractShotProductsForPull("nope")).toEqual([]);
  });

  test("includes products from shot.products and shot.looks[].products", () => {
    const shot = {
      id: "shot-1",
      products: [
        { familyId: "fam-1", familyName: "Jacket", colourId: "c-1", colourName: "Black", sizeScope: "all" },
      ],
      looks: [
        {
          id: "look-1",
          products: [
            { productId: "fam-2", productName: "Pants", colourId: "c-2", colourName: "Stone", size: "32", sizeScope: "single" },
          ],
        },
      ],
    };

    const result = extractShotProductsForPull(shot);
    expect(result).toHaveLength(2);
    expect(result.some((p) => (p.familyId || p.productId) === "fam-1")).toBe(true);
    expect(result.some((p) => (p.familyId || p.productId) === "fam-2")).toBe(true);
  });

  test("dedupes identical products across sources (family+colour+sizeScope+size)", () => {
    const base = { familyId: "fam-1", colourId: "c-1", sizeScope: "single", size: "M" };
    const shot = {
      id: "shot-1",
      products: [base],
      looks: [{ id: "look-1", products: [{ ...base, productId: "fam-1" }] }],
    };

    const result = extractShotProductsForPull(shot);
    expect(result).toHaveLength(1);
  });

  test("falls back to shot.productIds when no richer product data exists", () => {
    const familyById = new Map([
      ["fam-1", { id: "fam-1", styleName: "Jacket", styleNumber: "JKT-001" }],
    ]);
    const shot = { id: "shot-1", productIds: ["fam-1"] };

    const result = extractShotProductsForPull(shot, { familyById });
    expect(result).toHaveLength(1);
    expect(result[0].familyId).toBe("fam-1");
    expect(result[0].familyName).toBe("Jacket");
    expect(result[0].sizeScope).toBe("all");
    expect(result[0].colourName).toBe("Any colour");
  });
});

