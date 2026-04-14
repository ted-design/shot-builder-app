import { describe, expect, it } from "vitest";
import {
  isCorruptShotDescription,
  resolveShotDraftShortDescriptionSource,
  resolveShotShortDescriptionSource,
  resolveShotShortDescriptionText,
  resolveShotTypeText,
  shouldAutoFillDescriptionOnHeroChange,
  resolveExportDescription,
  getExportDescriptionText,
} from "../shotDescription";

describe("shotDescription", () => {
  it("detects HTML-ish fragments as corrupted description data", () => {
    expect(isCorruptShotDescription("<ul><li>Item</li></ul>")).toBe(true);
    expect(isCorruptShotDescription("ul><li><p>Small</p></li></ul>")).toBe(true);
    expect(isCorruptShotDescription("Some </p> fragment")).toBe(true);
  });

  it("detects description text that matches the notes preview", () => {
    expect(isCorruptShotDescription("Same text", "Same text")).toBe(true);
    expect(isCorruptShotDescription("<p>Same text</p>", "Same text")).toBe(true);
  });

  it("treats empty description as explicit", () => {
    const shot = { description: "", type: "Type value" };
    expect(resolveShotShortDescriptionSource(shot)).toBe("");
    expect(resolveShotShortDescriptionText(shot)).toBe("");
  });

  it("does not fall back to type when description is missing", () => {
    const shot = { type: "Type value" };
    expect(resolveShotShortDescriptionSource(shot)).toBe("");
    expect(resolveShotShortDescriptionText(shot)).toBe("");
  });

  it("strips rich HTML from the resolved short description", () => {
    const shot = { description: "<ul><li><p>Small</p></li></ul>" };
    expect(resolveShotShortDescriptionText(shot)).toBe("• Small");
  });

  it("treats empty draft description as explicit (no legacy fallback)", () => {
    const draft = { description: "", type: "Legacy value" };
    expect(resolveShotDraftShortDescriptionSource(draft)).toBe("");
  });

  it("resolves a sanitized shot type label", () => {
    const shot = { type: "ul><li><p>Small</p></li></ul>" };
    expect(resolveShotTypeText(shot)).toBe("• Small");
  });
});

describe("shouldAutoFillDescriptionOnHeroChange (Pattern A)", () => {
  it("returns true when description is empty", () => {
    expect(shouldAutoFillDescriptionOnHeroChange("", "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("", "")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange(null, "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange(undefined, "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("  ", "Charcoal")).toBe(true);
  });

  it("returns true when description matches previous hero colorway (case-insensitive)", () => {
    expect(shouldAutoFillDescriptionOnHeroChange("Charcoal", "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("charcoal", "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("CHARCOAL", "charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("Navy Blue", "Navy Blue")).toBe(true);
  });

  it("returns false when description is custom (does not match prevDerived)", () => {
    // User typed "Hero shot of navy product" — should NOT be overwritten
    expect(shouldAutoFillDescriptionOnHeroChange("Hero shot of navy product", "Charcoal")).toBe(false);
    // User typed "Black" manually, even though another product in the look is "Black"
    expect(shouldAutoFillDescriptionOnHeroChange("Black", "Charcoal")).toBe(false);
    // User typed a completely custom description
    expect(shouldAutoFillDescriptionOnHeroChange("My custom description", "Navy")).toBe(false);
  });

  it("returns false when prevDerived is empty but description has content", () => {
    // No previous hero set, but user has typed something
    expect(shouldAutoFillDescriptionOnHeroChange("Custom text", "")).toBe(false);
    expect(shouldAutoFillDescriptionOnHeroChange("Custom text", null)).toBe(false);
  });

  it("handles whitespace correctly", () => {
    // Whitespace-only description treated as empty
    expect(shouldAutoFillDescriptionOnHeroChange("   ", "Charcoal")).toBe(true);
    // Trimmed comparison
    expect(shouldAutoFillDescriptionOnHeroChange(" Charcoal ", "Charcoal")).toBe(true);
    expect(shouldAutoFillDescriptionOnHeroChange("Charcoal", " Charcoal ")).toBe(true);
  });
});

// ============================================================================
// Export Description Resolution Tests
// ============================================================================
// TRUTH TABLE:
// | description | type        | products include color? | Result       | Source    |
// |-------------|-------------|------------------------|--------------|-----------|
// | "Hero shot" | null        | N/A                    | "Hero shot"  | canonical |
// | "Hero shot" | "Black"     | N/A                    | "Hero shot"  | canonical |
// | ""          | "Hero shot" | No                     | "Hero shot"  | legacy    |
// | ""          | "Black"     | No                     | "Black"      | legacy    |
// | ""          | "Black"     | Yes (Black in product) | ""           | none      |
// | null        | "Charcoal"  | Yes (Charcoal Heather) | ""           | none      |
// | null        | "Navy Blue" | No                     | "Navy Blue"  | legacy    |
// | null        | "---"       | N/A                    | ""           | none      |
// | null        | null        | N/A                    | ""           | none      |
// ============================================================================

describe("resolveExportDescription (deterministic precedence)", () => {
  describe("Rule 1: Canonical description takes precedence", () => {
    it("returns canonical description when present", () => {
      const shot = { description: "Hero shot of model", type: "Black" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Hero shot of model");
      expect(result.source).toBe("canonical");
    });

    it("strips HTML from canonical description", () => {
      const shot = { description: "<p>Hero shot</p>", type: "Black" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Hero shot");
      expect(result.source).toBe("canonical");
    });

    it("ignores legacy type when canonical description exists", () => {
      const shot = { description: "Custom text", type: "Navy" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Custom text");
      expect(result.source).toBe("canonical");
    });
  });

  describe("Rule 2: Legacy fallback with safe checks", () => {
    it("falls back to legacy type when description is empty", () => {
      const shot = { description: "", type: "Hero shot in studio" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Hero shot in studio");
      expect(result.source).toBe("legacy");
    });

    it("falls back to legacy type when description is missing", () => {
      const shot = { type: "Hero shot in studio" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Hero shot in studio");
      expect(result.source).toBe("legacy");
    });

    it("strips HTML from legacy type", () => {
      const shot = { type: "<p>Studio shot</p>" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("Studio shot");
      expect(result.source).toBe("legacy");
    });

    it("suppresses dash-only legacy values", () => {
      const shot = { type: "---" };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("suppresses color-only legacy type when color appears in products", () => {
      const shot = { type: "Black" };
      const products = ["T-Shirt – Black (M)", "Hoodie – Navy (L)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("suppresses color-only legacy type with partial match", () => {
      const shot = { type: "Charcoal" };
      const products = ["Merino Tee – Charcoal Heather (all sizes)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("allows color-only legacy type when NOT in products", () => {
      const shot = { type: "Navy" };
      const products = ["T-Shirt – Black (M)", "Hoodie – White (L)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("Navy");
      expect(result.source).toBe("legacy");
    });

    it("allows non-color legacy type even when products have colors", () => {
      const shot = { type: "Hero shot with model" };
      const products = ["T-Shirt – Black (M)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("Hero shot with model");
      expect(result.source).toBe("legacy");
    });
  });

  describe("Rule 3: No description available", () => {
    it("returns empty when both fields are missing", () => {
      const shot = {};
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("returns empty for null shot", () => {
      const result = resolveExportDescription(null);
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("returns empty when description is whitespace-only", () => {
      const shot = { description: "   " };
      const result = resolveExportDescription(shot);
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });
  });

  describe("Color detection edge cases", () => {
    it("handles compound color names like Navy Blue", () => {
      const shot = { type: "Navy Blue" };
      const products = ["Jacket – Navy Blue (S)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("handles modified colors like Dark Grey", () => {
      const shot = { type: "Dark Grey" };
      const products = ["Pants – Dark Grey (32)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("is case-insensitive for color matching", () => {
      const shot = { type: "BLACK" };
      const products = ["T-Shirt – black (M)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("");
      expect(result.source).toBe("none");
    });

    it("does not suppress non-color short strings", () => {
      const shot = { type: "XL" };
      const products = ["T-Shirt – Black (XL)"];
      const result = resolveExportDescription(shot, { products });
      expect(result.text).toBe("XL");
      expect(result.source).toBe("legacy");
    });
  });
});

describe("getExportDescriptionText (convenience wrapper)", () => {
  it("returns just the text string", () => {
    const shot = { description: "Hero shot" };
    expect(getExportDescriptionText(shot)).toBe("Hero shot");
  });

  it("returns empty string for suppressed values", () => {
    const shot = { type: "Black" };
    const products = ["T-Shirt – Black (M)"];
    expect(getExportDescriptionText(shot, { products })).toBe("");
  });

  it("passes products from shot object if not in options", () => {
    const shot = { type: "Black", products: ["T-Shirt – Black (M)"] };
    expect(getExportDescriptionText(shot)).toBe("");
  });
});
