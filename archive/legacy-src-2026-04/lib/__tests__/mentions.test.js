import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMentionedUserIds,
  parseMentions,
  formatMention,
  renderMentions,
  stripMentionMarkup,
  hasMentions,
  detectMentionMode,
} from "../mentions";

describe("mentions utilities", () => {
  describe("getMentionedUserIds", () => {
    it("extracts user IDs from valid mentions", () => {
      const html = "@[Alex Rivera](user123) and @[John Doe](user456)";
      const result = getMentionedUserIds(html);
      expect(result).toEqual(["user123", "user456"]);
    });

    it("returns unique user IDs only", () => {
      const html = "@[Alex Rivera](user123) and @[Alex](user123) again";
      const result = getMentionedUserIds(html);
      expect(result).toEqual(["user123"]);
    });

    it("handles HTML with nested tags", () => {
      const html = "<p>Hey @[Alex](user123) <strong>check this</strong> @[Bob](user456)</p>";
      const result = getMentionedUserIds(html);
      expect(result).toEqual(["user123", "user456"]);
    });

    it("returns empty array for content without mentions", () => {
      const html = "This is just regular text";
      const result = getMentionedUserIds(html);
      expect(result).toEqual([]);
    });

    it("returns empty array for null input", () => {
      expect(getMentionedUserIds(null)).toEqual([]);
    });

    it("returns empty array for undefined input", () => {
      expect(getMentionedUserIds(undefined)).toEqual([]);
    });

    it("returns empty array for non-string input", () => {
      expect(getMentionedUserIds(123)).toEqual([]);
      expect(getMentionedUserIds({})).toEqual([]);
    });
  });

  describe("parseMentions", () => {
    it("parses mentions into structured objects", () => {
      const html = "@[Alex Rivera](user123) and @[John Doe](user456)";
      const result = parseMentions(html);
      expect(result).toEqual([
        { displayName: "Alex Rivera", userId: "user123" },
        { displayName: "John Doe", userId: "user456" },
      ]);
    });

    it("handles multiple mentions of same user", () => {
      const html = "@[Alex](user123) and @[Alex Rivera](user123)";
      const result = parseMentions(html);
      expect(result).toEqual([
        { displayName: "Alex", userId: "user123" },
        { displayName: "Alex Rivera", userId: "user123" },
      ]);
    });

    it("returns empty array for content without mentions", () => {
      const html = "Regular text";
      expect(parseMentions(html)).toEqual([]);
    });

    it("returns empty array for null/undefined", () => {
      expect(parseMentions(null)).toEqual([]);
      expect(parseMentions(undefined)).toEqual([]);
    });
  });

  describe("formatMention", () => {
    it("formats user object into mention string", () => {
      const user = { id: "user123", displayName: "Alex Rivera" };
      const result = formatMention(user);
      expect(result).toBe("@[Alex Rivera](user123)");
    });

    it("uses email as fallback if displayName is missing", () => {
      const user = { id: "user123", email: "alex@example.com" };
      const result = formatMention(user);
      expect(result).toBe("@[alex@example.com](user123)");
    });

    it("uses 'Unknown User' if both displayName and email are missing", () => {
      const user = { id: "user123" };
      const result = formatMention(user);
      expect(result).toBe("@[Unknown User](user123)");
    });

    it("sanitizes special characters that could break mention format", () => {
      const user = { id: "user123", displayName: "Alex [Rivera] (Test)" };
      const result = formatMention(user);
      expect(result).toBe("@[Alex Rivera Test](user123)");
    });

    it("sanitizes userId with special characters", () => {
      const user = { id: "user[123]", displayName: "Alex" };
      const result = formatMention(user);
      expect(result).toBe("@[Alex](user123)");
    });

    it("returns empty string for null user", () => {
      expect(formatMention(null)).toBe("");
    });

    it("returns empty string for user without id", () => {
      const user = { displayName: "Alex" };
      expect(formatMention(user)).toBe("");
    });
  });

  describe("renderMentions", () => {
    it("converts mention markup to styled HTML spans", () => {
      const html = "Hey @[Alex Rivera](user123)!";
      const result = renderMentions(html);
      expect(result).toContain('<span class="inline-flex items-center');
      expect(result).toContain("@Alex Rivera");
    });

    it("escapes HTML in display names to prevent XSS", () => {
      const html = "@[<script>alert('xss')</script>](user123)";
      const result = renderMentions(html);
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("handles multiple mentions", () => {
      const html = "@[Alex](user123) and @[Bob](user456)";
      const result = renderMentions(html);
      const spanMatches = result.match(/<span class="inline-flex/g);
      expect(spanMatches).toHaveLength(2);
    });

    it("preserves non-mention content", () => {
      const html = "Text before @[Alex](user123) text after";
      const result = renderMentions(html);
      expect(result).toContain("Text before");
      expect(result).toContain("text after");
    });

    it("returns original HTML if no mentions", () => {
      const html = "Just regular text";
      const result = renderMentions(html);
      expect(result).toBe(html);
    });

    it("returns input unchanged for null/undefined", () => {
      expect(renderMentions(null)).toBe(null);
      expect(renderMentions(undefined)).toBe(undefined);
    });
  });

  describe("stripMentionMarkup", () => {
    it("replaces mention markup with plain @mentions", () => {
      const html = "Hey @[Alex Rivera](user123)!";
      const result = stripMentionMarkup(html);
      expect(result).toBe("Hey @Alex Rivera!");
    });

    it("escapes HTML in display names", () => {
      const html = "@[<img src=x onerror=alert(1)>](user123)";
      const result = stripMentionMarkup(html);
      expect(result).not.toContain("<img");
      expect(result).toContain("&lt;img");
    });

    it("handles multiple mentions", () => {
      const html = "@[Alex](user123) and @[Bob](user456)";
      const result = stripMentionMarkup(html);
      expect(result).toBe("@Alex and @Bob");
    });

    it("preserves non-mention content", () => {
      const html = "Text @[Alex](user123) more text";
      const result = stripMentionMarkup(html);
      expect(result).toBe("Text @Alex more text");
    });

    it("returns original for content without mentions", () => {
      const html = "No mentions here";
      expect(stripMentionMarkup(html)).toBe(html);
    });

    it("returns input unchanged for null/undefined", () => {
      expect(stripMentionMarkup(null)).toBe(null);
      expect(stripMentionMarkup(undefined)).toBe(undefined);
    });
  });

  describe("hasMentions", () => {
    it("returns true when mentions are present", () => {
      const html = "Hey @[Alex](user123)!";
      expect(hasMentions(html)).toBe(true);
    });

    it("returns false when no mentions", () => {
      const html = "Just regular text";
      expect(hasMentions(html)).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(hasMentions(null)).toBe(false);
      expect(hasMentions(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(hasMentions("")).toBe(false);
    });
  });

  describe("detectMentionMode", () => {
    it("detects mention mode when @ is typed", () => {
      const text = "Hello @";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: true, query: "" });
    });

    it("captures query text after @", () => {
      const text = "Hello @alex";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: true, query: "alex" });
    });

    it("handles @ with partial names", () => {
      const text = "Hey @Alex-Rivera";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: true, query: "Alex-Rivera" });
    });

    it("handles @ with underscores", () => {
      const text = "Hey @user_name";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: true, query: "user_name" });
    });

    it("stops at space after mention query", () => {
      const text = "Hey @alex more text";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: false, query: "" });
    });

    it("returns false when @ is not at end", () => {
      const text = "Email: test@example.com and more";
      const result = detectMentionMode(text);
      expect(result).toEqual({ inMentionMode: false, query: "" });
    });

    it("returns false for null/undefined", () => {
      expect(detectMentionMode(null)).toEqual({ inMentionMode: false, query: "" });
      expect(detectMentionMode(undefined)).toEqual({ inMentionMode: false, query: "" });
    });

    it("returns false for empty string", () => {
      expect(detectMentionMode("")).toEqual({ inMentionMode: false, query: "" });
    });
  });

  describe("XSS Prevention", () => {
    it("prevents XSS in renderMentions with malicious displayName", () => {
      const maliciousHtml = "@[<script>alert('xss')</script>](user123)";
      const result = renderMentions(maliciousHtml);

      // Should escape the script tag
      expect(result).not.toContain("<script>");
      expect(result).toContain("&lt;script&gt;");
    });

    it("prevents XSS in stripMentionMarkup with HTML injection", () => {
      const maliciousHtml = "@[<img src=x onerror=alert('xss')>](user123)";
      const result = stripMentionMarkup(maliciousHtml);

      // Should escape the img tag
      expect(result).not.toContain("<img");
      expect(result).toContain("&lt;img");
    });

    it("prevents format breaking with special characters in formatMention", () => {
      const user = {
        id: "user](fake)",
        displayName: "Name][Fake"
      };
      const result = formatMention(user);

      // Should remove brackets and parens that could break the format
      expect(result).toBe("@[NameFake](userfake)");
    });
  });

  describe("Edge Cases", () => {
    it("handles empty mention displayName", () => {
      const html = "@[](user123)";
      const result = parseMentions(html);
      expect(result).toEqual([]);
    });

    it("handles empty mention userId", () => {
      const html = "@[Alex]()";
      const result = parseMentions(html);
      expect(result).toEqual([]);
    });

    it("handles malformed mention syntax", () => {
      const html = "@[Alex(user123) or @Alex](user456)";
      const mentions = parseMentions(html);
      // Should only match the correctly formatted one
      expect(mentions.length).toBeGreaterThan(0);
    });

    it("handles very long display names", () => {
      const longName = "A".repeat(500);
      const html = `@[${longName}](user123)`;
      const result = getMentionedUserIds(html);
      expect(result).toEqual(["user123"]);
    });

    it("handles mentions at start and end of text", () => {
      const html = "@[Alex](user123) middle @[Bob](user456)";
      const result = getMentionedUserIds(html);
      expect(result).toEqual(["user123", "user456"]);
    });
  });
});
