/**
 * Tests for versionLogger — meaningful-change detection
 *
 * Verifies that metadata-only changes (updatedAt, notesUpdatedAt, etc.)
 * do NOT produce a non-empty changedFields list, and therefore do NOT
 * trigger a version write.
 *
 * VH.5: Also verifies notes HTML normalization gate — rich-text churn
 * with identical visible text does NOT create a version.
 */

import { describe, it, expect } from "vitest";
import {
  getChangedFields,
  stripHtmlToText,
  normalizeText,
  notesMeaningfullyDifferent,
} from "../versionLogger";

describe("getChangedFields", () => {
  const baseShotData = {
    id: "shot-1",
    name: "Test Shot",
    notes: "<p>Hello</p>",
    status: "draft",
    looks: [{ id: "look-1", products: [] }],
  };

  it("returns empty array when only metadata fields change", () => {
    const previous = { ...baseShotData, updatedAt: "2025-01-01T00:00:00Z" };
    const current = { ...baseShotData, updatedAt: "2025-01-02T00:00:00Z" };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("returns empty array when only notesUpdatedAt/notesUpdatedBy change", () => {
    const previous = {
      ...baseShotData,
      notesUpdatedAt: "2025-01-01T00:00:00Z",
      notesUpdatedBy: { uid: "u1", displayName: "Alice" },
    };
    const current = {
      ...baseShotData,
      notesUpdatedAt: "2025-01-02T00:00:00Z",
      notesUpdatedBy: { uid: "u2", displayName: "Bob" },
    };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("returns empty array when a FieldValue sentinel is present", () => {
    // Simulate a serverTimestamp() sentinel
    const sentinel = { _methodName: "serverTimestamp" };
    const previous = { ...baseShotData, notesUpdatedAt: "2025-01-01T00:00:00Z" };
    const current = { ...baseShotData, notesUpdatedAt: sentinel };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("detects meaningful content changes", () => {
    const previous = { ...baseShotData };
    const current = { ...baseShotData, name: "Updated Shot Name" };
    expect(getChangedFields(previous, current)).toEqual(["name"]);
  });

  it("detects meaningful changes alongside metadata changes", () => {
    const previous = {
      ...baseShotData,
      updatedAt: "2025-01-01T00:00:00Z",
    };
    const current = {
      ...baseShotData,
      name: "New Name",
      updatedAt: "2025-01-02T00:00:00Z",
    };
    const result = getChangedFields(previous, current);
    expect(result).toEqual(["name"]);
    expect(result).not.toContain("updatedAt");
  });

  it("returns empty array when previousData or currentData is null", () => {
    expect(getChangedFields(null, baseShotData)).toEqual([]);
    expect(getChangedFields(baseShotData, null)).toEqual([]);
  });

  it("detects added and removed fields (non-metadata)", () => {
    const previous = { ...baseShotData };
    const current = { ...baseShotData, tags: ["product"] };
    expect(getChangedFields(previous, current)).toContain("tags");
  });

  it("returns empty array when notes content is unchanged but notes metadata changes", () => {
    const previous = {
      ...baseShotData,
      notes: "<p>Same notes</p>",
      notesUpdatedAt: "2025-01-01T00:00:00Z",
      notesUpdatedBy: { uid: "u1", displayName: "Alice" },
      updatedAt: "2025-01-01T00:00:00Z",
      updatedBy: "u1",
    };
    const current = {
      ...baseShotData,
      notes: "<p>Same notes</p>",
      notesUpdatedAt: "2025-01-02T00:00:00Z",
      notesUpdatedBy: { uid: "u2", displayName: "Bob" },
      updatedAt: "2025-01-02T00:00:00Z",
      updatedBy: "u2",
    };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("detects notes content change even when metadata also changes", () => {
    const previous = {
      ...baseShotData,
      notes: "<p>Old notes</p>",
      notesUpdatedAt: "2025-01-01T00:00:00Z",
    };
    const current = {
      ...baseShotData,
      notes: "<p>New notes with 11:18</p>",
      notesUpdatedAt: "2025-01-02T00:00:00Z",
    };
    const result = getChangedFields(previous, current);
    expect(result).toEqual(["notes"]);
    expect(result).not.toContain("notesUpdatedAt");
  });

  it("ignores all documented metadata fields", () => {
    const metadataOnlyPrevious = {
      ...baseShotData,
      createdAt: "a",
      createdBy: "a",
      updatedAt: "a",
      updatedBy: "a",
      deleted: false,
      deletedAt: null,
      notesUpdatedAt: "a",
      notesUpdatedBy: "a",
      lastViewedAt: "a",
      lastViewedBy: "a",
      looksUpdatedAt: "a",
      looksUpdatedBy: "a",
    };
    const metadataOnlyCurrent = {
      ...baseShotData,
      createdAt: "b",
      createdBy: "b",
      updatedAt: "b",
      updatedBy: "b",
      deleted: true,
      deletedAt: "b",
      notesUpdatedAt: "b",
      notesUpdatedBy: "b",
      lastViewedAt: "b",
      lastViewedBy: "b",
      looksUpdatedAt: "b",
      looksUpdatedBy: "b",
    };
    expect(getChangedFields(metadataOnlyPrevious, metadataOnlyCurrent)).toEqual([]);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VH.5 — Notes HTML normalization gate
  // ═══════════════════════════════════════════════════════════════════════════

  it("does NOT detect change when notes HTML differs but visible text is identical", () => {
    const previous = { ...baseShotData, notes: "<p>11:18</p>" };
    const current = { ...baseShotData, notes: "<p>  11:18 </p>" };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("does NOT detect change when notes have different wrapping tags but same text", () => {
    const previous = { ...baseShotData, notes: "<p>Hello world</p>" };
    const current = { ...baseShotData, notes: "<div><span>Hello world</span></div>" };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("does NOT detect change when notes differ only by &nbsp; vs space", () => {
    const previous = { ...baseShotData, notes: "<p>Hello&nbsp;world</p>" };
    const current = { ...baseShotData, notes: "<p>Hello world</p>" };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("detects real notes text change through HTML normalization", () => {
    const previous = { ...baseShotData, notes: "<p>11:18</p>" };
    const current = { ...baseShotData, notes: "<p>11:32</p>" };
    expect(getChangedFields(previous, current)).toEqual(["notes"]);
  });

  it("detects notes change from empty to non-empty", () => {
    const previous = { ...baseShotData, notes: "" };
    const current = { ...baseShotData, notes: "<p>New content</p>" };
    expect(getChangedFields(previous, current)).toEqual(["notes"]);
  });

  it("detects notes change from non-empty to empty", () => {
    const previous = { ...baseShotData, notes: "<p>Existing content</p>" };
    const current = { ...baseShotData, notes: "" };
    expect(getChangedFields(previous, current)).toEqual(["notes"]);
  });

  it("does NOT detect change when both notes are empty/null", () => {
    const previous = { ...baseShotData, notes: null };
    const current = { ...baseShotData, notes: "" };
    expect(getChangedFields(previous, current)).toEqual([]);
  });

  it("detects notes change alongside other field changes", () => {
    const previous = { ...baseShotData, notes: "<p>Old</p>", status: "draft" };
    const current = { ...baseShotData, notes: "<p>New</p>", status: "complete" };
    const result = getChangedFields(previous, current);
    expect(result).toContain("notes");
    expect(result).toContain("status");
    expect(result).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VH.5 — stripHtmlToText unit tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("stripHtmlToText", () => {
  it("strips HTML tags and returns plain text", () => {
    expect(stripHtmlToText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("decodes common HTML entities", () => {
    expect(stripHtmlToText("&amp; &lt; &gt; &quot; &#39;")).toBe('& < > " \'');
  });

  it("converts &nbsp; to space", () => {
    expect(stripHtmlToText("Hello&nbsp;world")).toBe("Hello world");
  });

  it("collapses whitespace", () => {
    expect(stripHtmlToText("<p>  Hello   world  </p>")).toBe("Hello world");
  });

  it('returns "" for null, undefined, and empty string', () => {
    expect(stripHtmlToText(null)).toBe("");
    expect(stripHtmlToText(undefined)).toBe("");
    expect(stripHtmlToText("")).toBe("");
  });

  it('returns "" for non-string values', () => {
    expect(stripHtmlToText(42)).toBe("");
    expect(stripHtmlToText({})).toBe("");
  });

  it('returns "" for HTML with no visible text', () => {
    expect(stripHtmlToText("<p>  </p>")).toBe("");
    expect(stripHtmlToText("<br><br>")).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VH.5 — normalizeText unit tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("normalizeText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  Hello   world  ")).toBe("Hello world");
  });

  it("normalizes \\r\\n to \\n then collapses", () => {
    expect(normalizeText("Hello\r\nworld")).toBe("Hello world");
  });

  it('returns "" for null, undefined, empty', () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText("")).toBe("");
  });

  it('returns "" for non-string', () => {
    expect(normalizeText(42)).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VH.5 — notesMeaningfullyDifferent unit tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("notesMeaningfullyDifferent", () => {
  it("returns false for identical HTML", () => {
    expect(notesMeaningfullyDifferent("<p>Hello</p>", "<p>Hello</p>")).toBe(false);
  });

  it("returns false for different HTML with same visible text", () => {
    expect(notesMeaningfullyDifferent("<p>Hello</p>", "<div>Hello</div>")).toBe(false);
  });

  it("returns false for whitespace-only HTML differences", () => {
    expect(notesMeaningfullyDifferent("<p>  Hello </p>", "<p>Hello</p>")).toBe(false);
  });

  it("returns true for different visible text", () => {
    expect(notesMeaningfullyDifferent("<p>Hello</p>", "<p>Goodbye</p>")).toBe(true);
  });

  it("returns true for empty to non-empty", () => {
    expect(notesMeaningfullyDifferent("", "<p>Content</p>")).toBe(true);
  });

  it("returns false for both null/empty", () => {
    expect(notesMeaningfullyDifferent(null, "")).toBe(false);
    expect(notesMeaningfullyDifferent(null, null)).toBe(false);
    expect(notesMeaningfullyDifferent("", undefined)).toBe(false);
  });
});
