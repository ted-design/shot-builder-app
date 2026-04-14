import { describe, expect, it } from "vitest";
import { computeSafeBackfillPatch } from "../useCallSheetConfig";

describe("computeSafeBackfillPatch", () => {
  describe("basic backfill behavior", () => {
    it("returns empty object when nothing needs backfilling", () => {
      const existing = { name: "test", value: 42 };
      const defaults = { name: "default", value: 0 };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({});
    });

    it("backfills missing keys from defaults", () => {
      const existing = { name: "test" };
      const defaults = { name: "default", value: 42, enabled: true };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({ value: 42, enabled: true });
    });

    it("backfills null values", () => {
      const existing = { name: "test", value: null };
      const defaults = { name: "default", value: 42 };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({ value: 42 });
    });

    it("backfills undefined values", () => {
      const existing = { name: "test", value: undefined };
      const defaults = { name: "default", value: 42 };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({ value: 42 });
    });
  });

  describe("array protection", () => {
    it("NEVER touches arrays in defaults - critical for sections/headerElements", () => {
      const existing = {};
      const defaults = {
        sections: [{ id: 1 }, { id: 2 }],
        headerElements: ["a", "b"],
        scalar: "value",
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Arrays should NOT be in the patch
      expect(result).not.toHaveProperty("sections");
      expect(result).not.toHaveProperty("headerElements");
      // Scalar should be backfilled
      expect(result).toHaveProperty("scalar", "value");
    });

    it("preserves user-customized arrays even when empty in existing", () => {
      const existing = { sections: [] };
      const defaults = {
        sections: [{ id: 1 }, { id: 2 }],
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Empty arrays should NOT be overwritten
      expect(result).toEqual({});
    });

    it("never touches nested arrays", () => {
      const existing = {
        colors: { primary: "#000" },
      };
      const defaults = {
        colors: {
          primary: "#FFF",
          palette: ["#111", "#222"],
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // palette array should not be included even in nested object
      expect(result).toEqual({});
    });
  });

  describe("nested object handling", () => {
    it("backfills missing keys in nested objects one level deep", () => {
      const existing = {
        colors: { primary: "#000" },
      };
      const defaults = {
        colors: {
          primary: "#FFF",
          secondary: "#888",
          accent: "#00F",
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Should merge new keys but preserve existing primary
      expect(result).toEqual({
        colors: {
          primary: "#000",
          secondary: "#888",
          accent: "#00F",
        },
      });
    });

    it("does not overwrite existing nested values", () => {
      const existing = {
        scheduleBlockFields: {
          showShotNumber: false, // User explicitly set to false
          showShotName: true,
        },
      };
      const defaults = {
        scheduleBlockFields: {
          showShotNumber: true, // Default is true
          showShotName: true,
          showDescription: true, // Missing in existing
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Should only add showDescription, preserve user's showShotNumber: false
      expect(result).toEqual({
        scheduleBlockFields: {
          showShotNumber: false, // Preserved!
          showShotName: true,
          showDescription: true, // Added
        },
      });
    });

    it("handles missing entire nested object", () => {
      const existing = {};
      const defaults = {
        colors: {
          primary: "#000",
          secondary: "#888",
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({
        colors: {
          primary: "#000",
          secondary: "#888",
        },
      });
    });

    it("returns empty patch for nested object when all keys exist", () => {
      const existing = {
        colors: {
          primary: "#111",
          secondary: "#222",
        },
      };
      const defaults = {
        colors: {
          primary: "#000",
          secondary: "#888",
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({});
    });
  });

  describe("edge cases", () => {
    it("handles empty existing object", () => {
      const existing = {};
      const defaults = {
        name: "default",
        value: 42,
        nested: { a: 1 },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({
        name: "default",
        value: 42,
        nested: { a: 1 },
      });
    });

    it("handles empty defaults object", () => {
      const existing = { name: "test" };
      const defaults = {};

      const result = computeSafeBackfillPatch(existing, defaults);

      expect(result).toEqual({});
    });

    it("handles falsy but valid existing values (0, false, empty string)", () => {
      const existing = {
        count: 0,
        enabled: false,
        name: "",
      };
      const defaults = {
        count: 100,
        enabled: true,
        name: "default",
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Should NOT overwrite 0, false, or empty string - they are valid values
      expect(result).toEqual({});
    });

    it("does not recurse more than one level deep", () => {
      const existing = {
        level1: {
          level2: {
            deep: "original",
          },
        },
      };
      const defaults = {
        level1: {
          level2: {
            deep: "default",
            newKey: "added",
          },
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // level2 is a nested object within level1, so level2's internals should NOT be patched
      // (only one level deep)
      expect(result).toEqual({});
    });
  });

  describe("CallSheetConfig-specific scenarios", () => {
    it("correctly backfills scheduleBlockFields without touching sections", () => {
      const existing = {
        id: "config-1",
        projectId: "proj-1",
        scheduleId: "sched-1",
        sections: [{ type: "schedule", id: "sec-1" }], // User's sections
        headerElements: ["logo", "title"], // User's header elements
        // Missing scheduleBlockFields
      };
      const defaults = {
        id: "default-id",
        projectId: "default-proj",
        scheduleId: "default-sched",
        schemaVersion: 1,
        sections: [{ type: "default" }],
        headerElements: ["default"],
        scheduleBlockFields: {
          showShotNumber: true,
          showShotName: true,
          showDescription: true,
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // Should only add schemaVersion and scheduleBlockFields
      // Should NOT touch sections or headerElements
      expect(result).toEqual({
        schemaVersion: 1,
        scheduleBlockFields: {
          showShotNumber: true,
          showShotName: true,
          showDescription: true,
        },
      });
      expect(result).not.toHaveProperty("sections");
      expect(result).not.toHaveProperty("headerElements");
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("projectId");
    });

    it("preserves user toggle settings when adding new fields", () => {
      const existing = {
        scheduleBlockFields: {
          showShotNumber: false, // User turned this OFF
          showShotName: true,
        },
      };
      const defaults = {
        scheduleBlockFields: {
          showShotNumber: true,
          showShotName: true,
          showDescription: true, // New field
          showTalent: true, // New field
          showLocation: true, // New field
        },
      };

      const result = computeSafeBackfillPatch(existing, defaults);

      // User's false should be preserved
      expect(result.scheduleBlockFields).toHaveProperty("showShotNumber", false);
      // New fields should be added
      expect(result.scheduleBlockFields).toHaveProperty("showDescription", true);
      expect(result.scheduleBlockFields).toHaveProperty("showTalent", true);
      expect(result.scheduleBlockFields).toHaveProperty("showLocation", true);
    });
  });
});
