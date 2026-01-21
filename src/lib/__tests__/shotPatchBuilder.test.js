import { describe, it, expect } from "vitest";
import { applyShotTextFieldSanitization } from "../shotPatchBuilder.js";

/**
 * Regression tests for notes/description field independence.
 *
 * These tests guard against a bug where updating one field (notes or description)
 * would inadvertently overwrite or sync with the other field.
 *
 * The invariant being tested:
 * - Patching ONLY notes must NOT affect description
 * - Patching ONLY description must NOT affect notes
 * - Both fields must remain independent in all write paths
 */

// Simple identity sanitizer for testing (real one strips dangerous HTML)
const identitySanitizer = (val) => val;

// Mock sanitizer that adds a marker to verify it was called
const markerSanitizer = (val) => `[sanitized]${val}`;

describe("applyShotTextFieldSanitization", () => {
  describe("notes/description independence invariant", () => {
    it("patching only notes does NOT add description to result", () => {
      const patch = { notes: "<p>My notes</p>" };
      const result = applyShotTextFieldSanitization(patch, identitySanitizer);

      expect(result).toHaveProperty("notes");
      expect(result).not.toHaveProperty("description");
      expect(Object.keys(result)).toEqual(["notes"]);
    });

    it("patching only description does NOT add notes to result", () => {
      const patch = { description: "Short description" };
      const result = applyShotTextFieldSanitization(patch, identitySanitizer);

      expect(result).toHaveProperty("description");
      expect(result).not.toHaveProperty("notes");
      expect(Object.keys(result)).toEqual(["description"]);
    });

    it("patching both fields keeps them independent (no cross-assignment)", () => {
      const patch = {
        notes: "<p>Notes content</p>",
        description: "Description content",
      };
      const result = applyShotTextFieldSanitization(patch, identitySanitizer);

      expect(result.notes).toBe("<p>Notes content</p>");
      expect(result.description).toBe("Description content");
      // Verify no mutation or cross-assignment
      expect(result.notes).not.toBe(result.description);
    });

    it("patching unrelated fields does NOT introduce notes or description", () => {
      const patch = { status: "done", name: "Shot A" };
      const result = applyShotTextFieldSanitization(patch, identitySanitizer);

      expect(result).not.toHaveProperty("notes");
      expect(result).not.toHaveProperty("description");
      expect(result).toEqual({ status: "done", name: "Shot A" });
    });
  });

  describe("sanitization behavior", () => {
    it("applies sanitizer to notes when present", () => {
      const patch = { notes: "raw notes" };
      const result = applyShotTextFieldSanitization(patch, markerSanitizer);

      expect(result.notes).toBe("[sanitized]raw notes");
    });

    it("applies sanitizer to description when present", () => {
      const patch = { description: "raw desc" };
      const result = applyShotTextFieldSanitization(patch, markerSanitizer);

      expect(result.description).toBe("[sanitized]raw desc");
    });

    it("handles empty string notes", () => {
      const patch = { notes: "" };
      const result = applyShotTextFieldSanitization(patch, markerSanitizer);

      expect(result.notes).toBe("[sanitized]");
      expect(result).not.toHaveProperty("description");
    });

    it("handles null/undefined notes (coerces to empty string)", () => {
      const patch = { notes: null };
      const result = applyShotTextFieldSanitization(patch, markerSanitizer);

      expect(result.notes).toBe("[sanitized]");
    });

    it("preserves other patch fields unchanged", () => {
      const patch = {
        notes: "notes",
        status: "in_progress",
        tags: ["tag1", "tag2"],
        locationId: "loc-123",
      };
      const result = applyShotTextFieldSanitization(patch, markerSanitizer);

      expect(result.notes).toBe("[sanitized]notes");
      expect(result.status).toBe("in_progress");
      expect(result.tags).toEqual(["tag1", "tag2"]);
      expect(result.locationId).toBe("loc-123");
    });
  });

  describe("edge cases", () => {
    it("returns null/undefined input unchanged", () => {
      expect(applyShotTextFieldSanitization(null, identitySanitizer)).toBeNull();
      expect(applyShotTextFieldSanitization(undefined, identitySanitizer)).toBeUndefined();
    });

    it("does not mutate the original patch object", () => {
      const original = { notes: "test", other: "field" };
      const frozen = Object.freeze({ ...original });

      // Should not throw even with frozen object pattern
      const result = applyShotTextFieldSanitization(frozen, markerSanitizer);

      expect(result).not.toBe(frozen);
      expect(result.notes).toBe("[sanitized]test");
      expect(frozen.notes).toBe("test"); // Original unchanged
    });
  });
});
