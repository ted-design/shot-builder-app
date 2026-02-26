import { describe, it, expect } from "vitest"
import {
  projectNameSchema,
  shotTitleSchema,
  optionalUrlSchema,
  optionalNotesSchema,
  validateField,
} from "./validation"

describe("projectNameSchema", () => {
  it("rejects empty string", () => {
    const result = projectNameSchema.safeParse("")
    expect(result.success).toBe(false)
  })

  it("rejects whitespace-only string", () => {
    const result = projectNameSchema.safeParse("   ")
    expect(result.success).toBe(false)
  })

  it("accepts valid name", () => {
    const result = projectNameSchema.safeParse("Spring Campaign 2026")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("Spring Campaign 2026")
  })

  it("trims whitespace", () => {
    const result = projectNameSchema.safeParse("  My Project  ")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("My Project")
  })

  it("rejects string over 200 chars", () => {
    const result = projectNameSchema.safeParse("a".repeat(201))
    expect(result.success).toBe(false)
  })
})

describe("shotTitleSchema", () => {
  it("rejects empty string", () => {
    expect(shotTitleSchema.safeParse("").success).toBe(false)
  })

  it("accepts valid title", () => {
    const result = shotTitleSchema.safeParse("Hero Banner - White Tee")
    expect(result.success).toBe(true)
  })
})

describe("optionalUrlSchema", () => {
  it("accepts empty string", () => {
    const result = optionalUrlSchema.safeParse("")
    expect(result.success).toBe(true)
  })

  it("accepts valid https URL", () => {
    const result = optionalUrlSchema.safeParse("https://example.com/brief")
    expect(result.success).toBe(true)
  })

  it("accepts valid http URL", () => {
    const result = optionalUrlSchema.safeParse("http://example.com")
    expect(result.success).toBe(true)
  })

  it("rejects non-URL string", () => {
    const result = optionalUrlSchema.safeParse("not-a-url")
    expect(result.success).toBe(false)
  })

  it("rejects ftp protocol", () => {
    const result = optionalUrlSchema.safeParse("ftp://example.com")
    expect(result.success).toBe(false)
  })

  it("trims whitespace before validation", () => {
    const result = optionalUrlSchema.safeParse("  https://example.com  ")
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toBe("https://example.com")
  })
})

describe("optionalNotesSchema", () => {
  it("accepts empty string", () => {
    expect(optionalNotesSchema.safeParse("").success).toBe(true)
  })

  it("accepts normal notes", () => {
    expect(optionalNotesSchema.safeParse("Some notes here").success).toBe(true)
  })

  it("rejects notes over 5000 chars", () => {
    expect(optionalNotesSchema.safeParse("a".repeat(5001)).success).toBe(false)
  })
})

describe("validateField", () => {
  it("returns null for valid input", () => {
    expect(validateField(projectNameSchema, "Valid")).toBeNull()
  })

  it("returns error message for invalid input", () => {
    const result = validateField(projectNameSchema, "")
    expect(result).toBe("Project name is required")
  })

  it("returns first error for multi-error case", () => {
    const result = validateField(optionalUrlSchema, "not-a-url")
    expect(result).toBe("Must be a valid URL starting with https://")
  })
})
