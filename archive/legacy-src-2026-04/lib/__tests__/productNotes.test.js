import { describe, it, expect } from "vitest";
import { getProductNotesText } from "../productNotes";

describe("getProductNotesText", () => {
  describe("null/undefined/empty handling", () => {
    it("returns empty string for null", () => {
      expect(getProductNotesText(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(getProductNotesText(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(getProductNotesText("")).toBe("");
    });

    it("returns empty string for empty array", () => {
      expect(getProductNotesText([])).toBe("");
    });
  });

  describe("legacy string format", () => {
    it("returns plain text unchanged", () => {
      expect(getProductNotesText("Simple note text")).toBe("Simple note text");
    });

    it("strips HTML tags from string", () => {
      expect(getProductNotesText("<p>Hello world</p>")).toBe("Hello world");
    });

    it("strips nested HTML tags", () => {
      expect(
        getProductNotesText("<ul><li><p>Stretch twill</p></li><li><p>Second item</p></li></ul>")
      ).toBe("• Stretch twill\n• Second item");
    });

    it("handles rich text editor output", () => {
      expect(
        getProductNotesText("<p>This is <strong>bold</strong> text.</p>")
      ).toBe("This is bold text.");
    });

    it("converts br tags to newlines", () => {
      expect(getProductNotesText("Line 1<br/>Line 2")).toBe("Line 1\nLine 2");
    });

    it("converts paragraph breaks to newlines", () => {
      expect(getProductNotesText("<p>Para 1</p><p>Para 2</p>")).toBe(
        "Para 1\nPara 2"
      );
    });
  });

  describe("array format", () => {
    it("extracts text from single note object", () => {
      const notes = [{ id: "1", text: "Note content", createdAt: new Date() }];
      expect(getProductNotesText(notes)).toBe("Note content");
    });

    it("joins multiple notes with double newlines", () => {
      const notes = [
        { id: "1", text: "First note" },
        { id: "2", text: "Second note" },
      ];
      expect(getProductNotesText(notes)).toBe("First note\n\nSecond note");
    });

    it("strips HTML from array note text", () => {
      const notes = [
        { id: "1", text: "<p>HTML content</p>" },
        { id: "2", text: "<ul><li>List item</li></ul>" },
      ];
      expect(getProductNotesText(notes)).toBe("HTML content\n\n• List item");
    });

    it("filters out empty/null entries", () => {
      const notes = [
        { id: "1", text: "Valid note" },
        null,
        { id: "2", text: "" },
        { id: "3", text: "   " },
        { id: "4", text: "Another valid note" },
      ];
      expect(getProductNotesText(notes)).toBe("Valid note\n\nAnother valid note");
    });

    it("filters out entries without text property", () => {
      const notes = [
        { id: "1", text: "Has text" },
        { id: "2" },
        { id: "3", text: "Also has text" },
      ];
      expect(getProductNotesText(notes)).toBe("Has text\n\nAlso has text");
    });

    it("handles notes with only HTML that becomes empty after stripping", () => {
      const notes = [
        { id: "1", text: "<p></p>" },
        { id: "2", text: "<p>&nbsp;</p>" },
        { id: "3", text: "Actual content" },
      ];
      expect(getProductNotesText(notes)).toBe("Actual content");
    });
  });

  describe("real-world examples", () => {
    it("handles the exact HTML causing the bug", () => {
      // This is the exact input that was showing raw HTML on the Product Detail page
      const htmlNotes = "<ul><li><p>Stretch twill fabric</p></li><li><p>Button fly</p></li><li><p>Five-pocket design</p></li></ul>";
      const result = getProductNotesText(htmlNotes);

      // Should NOT contain any HTML tags
      expect(result).not.toContain("<ul>");
      expect(result).not.toContain("<li>");
      expect(result).not.toContain("<p>");
      expect(result).not.toContain("</");

      // Should contain the actual content
      expect(result).toContain("Stretch twill fabric");
      expect(result).toContain("Button fly");
      expect(result).toContain("Five-pocket design");
    });

    it("handles complex nested HTML from rich text editor", () => {
      const complexHtml = `
        <div class="editor-content">
          <p><strong>Key Features:</strong></p>
          <ul>
            <li>100% organic cotton</li>
            <li>Pre-washed for softness</li>
          </ul>
          <p>Available in multiple colors.</p>
        </div>
      `;
      const result = getProductNotesText(complexHtml);

      expect(result).not.toContain("<");
      expect(result).not.toContain(">");
      expect(result).toContain("Key Features:");
      expect(result).toContain("100% organic cotton");
    });

    it("handles array with HTML content from structured notes", () => {
      const notes = [
        { id: "1", text: "<p>Material: 100% cotton twill</p>", createdAt: "2025-01-15" },
        { id: "2", text: "<ul><li>Machine washable</li><li>Tumble dry low</li></ul>", createdAt: "2025-01-16" },
      ];
      const result = getProductNotesText(notes);

      expect(result).not.toContain("<p>");
      expect(result).not.toContain("<ul>");
      expect(result).not.toContain("<li>");
      expect(result).toContain("Material: 100% cotton twill");
      expect(result).toContain("Machine washable");
    });
  });

  describe("edge cases", () => {
    it("handles non-array, non-string types gracefully", () => {
      // These should return empty string and not throw
      expect(getProductNotesText(123)).toBe("");
      expect(getProductNotesText({})).toBe("");
      expect(getProductNotesText(true)).toBe("");
    });

    it("preserves intentional line breaks", () => {
      const notes = "Line 1\nLine 2\nLine 3";
      expect(getProductNotesText(notes)).toBe("Line 1\nLine 2\nLine 3");
    });

    it("normalizes excessive whitespace", () => {
      const notes = "Too    many     spaces";
      expect(getProductNotesText(notes)).toBe("Too many spaces");
    });
  });
});
