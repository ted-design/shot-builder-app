import { describe, it, expect } from "vitest";
import { stripHtml } from "../stripHtml";

describe("stripHtml", () => {
  describe("null/undefined/empty handling", () => {
    it("returns empty string for null", () => {
      expect(stripHtml(null)).toBe("");
    });

    it("returns empty string for undefined", () => {
      expect(stripHtml(undefined)).toBe("");
    });

    it("returns empty string for empty string", () => {
      expect(stripHtml("")).toBe("");
    });

    it("returns empty string for non-string types", () => {
      expect(stripHtml(123)).toBe("");
      expect(stripHtml({})).toBe("");
      expect(stripHtml([])).toBe("");
      expect(stripHtml(true)).toBe("");
    });
  });

  describe("HTML tag stripping", () => {
    it("removes simple HTML tags", () => {
      expect(stripHtml("<p>Hello</p>")).toBe("Hello");
    });

    it("removes nested HTML tags", () => {
      expect(stripHtml("<div><p><strong>Bold text</strong></p></div>")).toBe(
        "Bold text"
      );
    });

    it("removes self-closing tags", () => {
      expect(stripHtml("Line 1<br/>Line 2")).toBe("Line 1\nLine 2");
    });

    it("removes tags with attributes", () => {
      expect(stripHtml('<a href="http://example.com">Link</a>')).toBe("Link");
      expect(stripHtml('<div class="container">Content</div>')).toBe("Content");
    });
  });

  describe("line break conversion", () => {
    it("converts <br> to newlines", () => {
      expect(stripHtml("Line 1<br>Line 2")).toBe("Line 1\nLine 2");
    });

    it("converts <br/> to newlines", () => {
      expect(stripHtml("Line 1<br/>Line 2")).toBe("Line 1\nLine 2");
    });

    it("converts <br /> to newlines", () => {
      expect(stripHtml("Line 1<br />Line 2")).toBe("Line 1\nLine 2");
    });

    it("converts closing </p> and </div> to newlines", () => {
      expect(stripHtml("<p>Para 1</p><p>Para 2</p>")).toBe("Para 1\nPara 2");
      expect(stripHtml("<div>Div 1</div><div>Div 2</div>")).toBe(
        "Div 1\nDiv 2"
      );
    });

    it("converts <li> to bullet points", () => {
      expect(stripHtml("<ul><li>Item 1</li><li>Item 2</li></ul>")).toBe(
        "• Item 1\n• Item 2"
      );
    });
  });

  describe("empty HTML fallback (the bug this PR fixes)", () => {
    it("returns empty string for empty paragraph tags", () => {
      expect(stripHtml("<p></p>")).toBe("");
    });

    it("returns empty string for paragraph with only whitespace", () => {
      expect(stripHtml("<p>   </p>")).toBe("");
    });

    it("returns empty string for nested empty tags", () => {
      expect(stripHtml("<div><p></p></div>")).toBe("");
    });

    it("returns empty string for multiple empty tags", () => {
      expect(stripHtml("<p></p><p></p><p></p>")).toBe("");
    });

    it("returns empty string for tags with only &nbsp;", () => {
      expect(stripHtml("<p>&nbsp;</p>")).toBe("");
    });

    it("returns empty string for complex empty HTML", () => {
      expect(stripHtml("<div><p>&nbsp;</p><br/></div>")).toBe("");
    });
  });

  describe("whitespace normalization", () => {
    it("normalizes multiple spaces to single space", () => {
      expect(stripHtml("Hello    world")).toBe("Hello world");
    });

    it("normalizes tabs to single space", () => {
      expect(stripHtml("Hello\t\tworld")).toBe("Hello world");
    });

    it("removes carriage returns", () => {
      expect(stripHtml("Hello\r\nworld")).toBe("Hello\nworld");
    });

    it("collapses consecutive newlines from whitespace normalization", () => {
      // The whitespace normalization regex (\s*\n\s*) collapses consecutive newlines
      expect(stripHtml("Hello\n\n\n\nworld")).toBe("Hello\nworld");
    });

    it("trims leading and trailing whitespace", () => {
      expect(stripHtml("   Hello world   ")).toBe("Hello world");
    });
  });

  describe("HTML entities", () => {
    it("converts &nbsp; to space (then normalizes)", () => {
      expect(stripHtml("Hello&nbsp;world")).toBe("Hello world");
    });

    it("handles multiple &nbsp; entities", () => {
      expect(stripHtml("Hello&nbsp;&nbsp;&nbsp;world")).toBe("Hello world");
    });
  });

  describe("real-world examples", () => {
    it("handles rich text editor output", () => {
      const input = "<p>This is a <strong>bold</strong> sentence.</p>";
      expect(stripHtml(input)).toBe("This is a bold sentence.");
    });

    it("handles complex nested structures", () => {
      const input = `
        <div class="editor">
          <p>First paragraph</p>
          <ul>
            <li>Item one</li>
            <li>Item two</li>
          </ul>
          <p>Last paragraph</p>
        </div>
      `;
      const result = stripHtml(input);
      expect(result).toContain("First paragraph");
      expect(result).toContain("• Item one");
      expect(result).toContain("• Item two");
      expect(result).toContain("Last paragraph");
    });

    it("preserves meaningful text from legacy shot descriptions", () => {
      expect(stripHtml("<p>Product lifestyle shot</p>")).toBe(
        "Product lifestyle shot"
      );
    });
  });
});
