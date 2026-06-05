import { describe, it, expect } from "vitest"
import {
  STATUS_COLORS,
  STATUS_LABELS,
  getStatusColor,
  getStatusLabel,
  getBriefHost,
  isSafeHttpUrl,
} from "@/features/projects/lib/projectStatus"

describe("projectStatus maps", () => {
  it("maps known statuses to colors", () => {
    expect(STATUS_COLORS.active).toBe("green")
    expect(STATUS_COLORS.completed).toBe("blue")
    expect(STATUS_COLORS.archived).toBe("gray")
  })

  it("maps known statuses to labels", () => {
    expect(STATUS_LABELS.active).toBe("Active")
    expect(STATUS_LABELS.completed).toBe("Completed")
    expect(STATUS_LABELS.archived).toBe("Archived")
  })
})

describe("getStatusColor", () => {
  it("returns the mapped color for a known status", () => {
    expect(getStatusColor("active")).toBe("green")
    expect(getStatusColor("completed")).toBe("blue")
    expect(getStatusColor("archived")).toBe("gray")
  })

  it("falls back to gray for an unknown status", () => {
    expect(getStatusColor("on_fire")).toBe("gray")
    expect(getStatusColor("")).toBe("gray")
  })
})

describe("getStatusLabel", () => {
  it("returns the mapped label for a known status", () => {
    expect(getStatusLabel("active")).toBe("Active")
    expect(getStatusLabel("completed")).toBe("Completed")
    expect(getStatusLabel("archived")).toBe("Archived")
  })

  it("falls back to the raw status string when unknown", () => {
    expect(getStatusLabel("draft")).toBe("draft")
    expect(getStatusLabel("")).toBe("")
  })
})

describe("getBriefHost", () => {
  it("returns the hostname for a valid url", () => {
    expect(getBriefHost("https://example.com/brief")).toBe("example.com")
    expect(getBriefHost("https://docs.google.com/document/d/abc")).toBe(
      "docs.google.com",
    )
  })

  it("strips a leading www.", () => {
    expect(getBriefHost("https://www.example.com/brief")).toBe("example.com")
  })

  it("trims surrounding whitespace before parsing", () => {
    expect(getBriefHost("  https://example.com/brief  ")).toBe("example.com")
  })

  it("returns an empty string for empty / nullish input", () => {
    expect(getBriefHost("")).toBe("")
    expect(getBriefHost("   ")).toBe("")
    expect(getBriefHost(null)).toBe("")
    expect(getBriefHost(undefined)).toBe("")
  })

  it("returns an empty string for an unparseable url", () => {
    expect(getBriefHost("not a url")).toBe("")
    expect(getBriefHost("example.com")).toBe("")
  })
})

describe("isSafeHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isSafeHttpUrl("https://example.com/brief")).toBe(true)
    expect(isSafeHttpUrl("http://example.com")).toBe(true)
    expect(isSafeHttpUrl("  https://example.com  ")).toBe(true)
  })

  it("rejects dangerous and non-http schemes", () => {
    expect(isSafeHttpUrl("javascript:alert(document.cookie)")).toBe(false)
    expect(isSafeHttpUrl("data:text/html,<script>alert(1)</script>")).toBe(false)
    expect(isSafeHttpUrl("vbscript:msgbox(1)")).toBe(false)
    expect(isSafeHttpUrl("file:///etc/passwd")).toBe(false)
  })

  it("rejects unparseable / scheme-less / empty input", () => {
    expect(isSafeHttpUrl("not a url")).toBe(false)
    expect(isSafeHttpUrl("example.com")).toBe(false)
    expect(isSafeHttpUrl("")).toBe(false)
    expect(isSafeHttpUrl("   ")).toBe(false)
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
  })
})
