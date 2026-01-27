import { describe, expect, it } from "vitest";
import {
  isCorruptShotDescription,
  resolveShotDraftShortDescriptionSource,
  resolveShotShortDescriptionSource,
  resolveShotShortDescriptionText,
  resolveShotTypeText,
  shouldAutoFillDescriptionOnHeroChange,
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
