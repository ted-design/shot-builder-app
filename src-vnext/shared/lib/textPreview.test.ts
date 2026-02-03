import { describe, it, expect } from "vitest"
import { textPreview } from "./textPreview"

describe("textPreview", () => {
  it("returns empty string for null/undefined", () => {
    expect(textPreview(null)).toBe("")
    expect(textPreview(undefined)).toBe("")
    expect(textPreview("")).toBe("")
  })

  it("strips HTML tags", () => {
    expect(textPreview("<p>Hello <strong>world</strong></p>")).toBe("Hello world")
  })

  it("decodes common HTML entities", () => {
    expect(textPreview("Tom &amp; Jerry &lt;3&gt;")).toBe('Tom & Jerry <3>')
  })

  it("decodes &quot; and &#39;", () => {
    expect(textPreview("&quot;Hi&#39;s&quot;")).toBe('"Hi\'s"')
  })

  it("decodes &nbsp;", () => {
    expect(textPreview("word&nbsp;another")).toBe("word another")
  })

  it("collapses whitespace", () => {
    expect(textPreview("  lots   of   spaces  ")).toBe("lots of spaces")
  })

  it("handles nested HTML with whitespace", () => {
    expect(textPreview("<p></p><p>Line one</p><p>Line two</p>")).toBe("Line one Line two")
  })

  it("truncates to maxLength with ellipsis", () => {
    const long = "a".repeat(200)
    const result = textPreview(long, 120)
    expect(result.length).toBe(121) // 120 chars + ellipsis
    expect(result.endsWith("\u2026")).toBe(true)
  })

  it("does not truncate text within limit", () => {
    const short = "Short text"
    expect(textPreview(short, 120)).toBe("Short text")
  })

  it("respects custom maxLength", () => {
    const result = textPreview("Hello world this is a test", 11)
    expect(result).toBe("Hello world\u2026")
  })

  it("handles real legacy HTML description", () => {
    const legacy = '<p><strong>Close-up on product</strong></p><p>Talent holds bag, camera at eye level</p>'
    const result = textPreview(legacy)
    expect(result).toBe("Close-up on product Talent holds bag, camera at eye level")
    expect(result).not.toContain("<")
    expect(result).not.toContain(">")
  })
})
