import { describe, it, expect } from "vitest";
import { upsertPullItem } from "../../lib/pullItems";

describe("upsertPullItem", () => {
  const baseItem = {
    id: "a1",
    familyId: "fam",
    familyName: "Hoodie",
    colourId: "blk",
    colourName: "Black",
    sizes: [
      { size: "S", quantity: 2, fulfilled: 0, status: "pending" },
      { size: "M", quantity: 1, fulfilled: 0, status: "pending" },
    ],
    notes: "Initial",
    shotIds: ["s1"],
  };

  it("appends when no existing match", () => {
    const incoming = { ...baseItem, id: "b2", colourId: "gry", colourName: "Grey" };
    const result = upsertPullItem([baseItem], incoming);
    expect(result).toHaveLength(2);
  });

  it("merges sizes and notes when matching by familyId+colourId", () => {
    const incoming = {
      id: "b2",
      familyId: "fam",
      familyName: "Hoodie",
      colourId: "blk",
      colourName: "Black",
      sizes: [
        { size: "S", quantity: 1, fulfilled: 1, status: "fulfilled" },
        { size: "L", quantity: 3, fulfilled: 0, status: "pending" },
      ],
      notes: "Extra",
      shotIds: ["s2"],
    };
    const result = upsertPullItem([baseItem], incoming);
    expect(result).toHaveLength(1);
    const merged = result[0];
    // S -> 2 + 1 = 3; fulfilled -> 0 + 1 = 1
    const s = merged.sizes.find((x) => x.size === "S");
    const l = merged.sizes.find((x) => x.size === "L");
    expect(s.quantity).toBe(3);
    expect(s.fulfilled).toBe(1);
    expect(l.quantity).toBe(3);
    // notes merged
    expect(merged.notes).toContain("Initial");
    expect(merged.notes).toContain("Extra");
    // shotIds deduped
    expect(merged.shotIds.sort()).toEqual(["s1", "s2"].sort());
  });

  it("excludes original by ID when editing to a matching row", () => {
    const otherRow = {
      id: "z9",
      familyId: "fam",
      familyName: "Hoodie",
      colourId: "blk",
      colourName: "Black",
      sizes: [{ size: "S", quantity: 1, fulfilled: 0, status: "pending" }],
      notes: "",
    };
    const incomingEdited = {
      id: "a1",
      familyId: "fam",
      familyName: "Hoodie",
      colourId: "blk",
      colourName: "Black",
      sizes: [{ size: "S", quantity: 2, fulfilled: 0, status: "pending" }],
      notes: "Edit",
    };
    const result = upsertPullItem([baseItem, otherRow], incomingEdited, { excludeId: "a1" });
    expect(result).toHaveLength(1); // a1 removed, merged into z9
    const merged = result[0];
    const s = merged.sizes.find((x) => x.size === "S");
    expect(s.quantity).toBe(3);
  });
});

