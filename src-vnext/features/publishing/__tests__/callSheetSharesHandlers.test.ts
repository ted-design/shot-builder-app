// @vitest-environment node
/**
 * Unit tests for the pure helpers in `functions/src/callSheetShares.js`
 * (Phase 3 publishing handlers). Emulator-gated integration tests live in
 * `callSheetSharesHandlers.integration.test.ts` and auto-skip without
 * FIRESTORE_EMULATOR_HOST set.
 */

import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const require = createRequire(import.meta.url)
const handlers = require(
  resolve(__dirname, "../../../../functions/src/callSheetShares.js"),
) as {
  parseCompoundToken: (t: unknown) => { shareGroupId: string; recipientToken: string } | null
  hashIp: (ip: unknown) => string
  formatShootDate: (ts: unknown) => string
  formatConfirmationTime: (ts: unknown) => string
  validatePublishRecipients: (input: unknown) => Array<Record<string, unknown>>
  VIEW_RATE_LIMIT_MS: number
}

describe("parseCompoundToken", () => {
  it("returns halves for a valid compound token", () => {
    expect(handlers.parseCompoundToken("shareA.recipientB")).toEqual({
      shareGroupId: "shareA",
      recipientToken: "recipientB",
    })
  })

  it("rejects tokens without a dot", () => {
    expect(handlers.parseCompoundToken("noDot")).toBeNull()
  })

  it("rejects tokens with an empty share or recipient half", () => {
    expect(handlers.parseCompoundToken(".recipient")).toBeNull()
    expect(handlers.parseCompoundToken("share.")).toBeNull()
  })

  it("rejects tokens with multiple dots", () => {
    expect(handlers.parseCompoundToken("a.b.c")).toBeNull()
  })

  it("rejects non-strings", () => {
    expect(handlers.parseCompoundToken(null)).toBeNull()
    expect(handlers.parseCompoundToken(123)).toBeNull()
  })
})

describe("hashIp", () => {
  it("produces a 64-char hex digest (SHA-256)", () => {
    const digest = handlers.hashIp("192.0.2.1")
    expect(digest).toMatch(/^[0-9a-f]{64}$/)
  })

  it("is deterministic for the same input", () => {
    expect(handlers.hashIp("10.0.0.1")).toBe(handlers.hashIp("10.0.0.1"))
  })

  it("produces different digests for different IPs", () => {
    expect(handlers.hashIp("10.0.0.1")).not.toBe(handlers.hashIp("10.0.0.2"))
  })

  it("tolerates non-string input without throwing", () => {
    expect(handlers.hashIp(null)).toMatch(/^[0-9a-f]{64}$/)
    expect(handlers.hashIp(undefined)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe("formatShootDate", () => {
  it("formats a Date", () => {
    const date = new Date("2026-09-22T12:00:00Z")
    const label = handlers.formatShootDate(date)
    expect(label).toContain("2026")
    expect(label).toContain("Sep")
  })

  it("formats a Firestore Timestamp-shaped object (toDate())", () => {
    const mockTimestamp = {
      toDate: () => new Date("2026-09-22T12:00:00Z"),
    }
    expect(handlers.formatShootDate(mockTimestamp)).toContain("Sep")
  })

  it("returns empty string for null/undefined", () => {
    expect(handlers.formatShootDate(null)).toBe("")
    expect(handlers.formatShootDate(undefined)).toBe("")
  })

  it("returns empty string for invalid input", () => {
    expect(handlers.formatShootDate("not-a-date")).toBe("")
  })
})

describe("formatConfirmationTime", () => {
  it("formats a Date with month/day/time", () => {
    const date = new Date("2026-09-22T15:47:00Z")
    const label = handlers.formatConfirmationTime(date)
    expect(label).toContain("Sep")
    // May contain 15:47 or 11:47 depending on TZ — just ensure non-empty.
    expect(label.length).toBeGreaterThan(0)
  })

  it("returns empty string for null", () => {
    expect(handlers.formatConfirmationTime(null)).toBe("")
  })
})

describe("validatePublishRecipients", () => {
  it("accepts a minimal valid recipient", () => {
    const result = handlers.validatePublishRecipients([
      { personKind: "talent", name: "Alex", email: "alex@example.test" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe("Alex")
    expect(result[0]!.email).toBe("alex@example.test")
    expect(result[0]!.personId).toBeNull()
  })

  it("rejects empty array", () => {
    expect(() => handlers.validatePublishRecipients([])).toThrow(
      /At least one recipient/,
    )
  })

  it("rejects non-array input", () => {
    expect(() => handlers.validatePublishRecipients("not-array")).toThrow()
    expect(() => handlers.validatePublishRecipients(null)).toThrow()
  })

  it("rejects more than 200 recipients", () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      personKind: "talent",
      name: `R${i}`,
      email: `r${i}@example.test`,
    }))
    expect(() => handlers.validatePublishRecipients(many)).toThrow(/Too many/)
  })

  it("rejects invalid personKind", () => {
    expect(() =>
      handlers.validatePublishRecipients([
        { personKind: "robot", name: "Bot", email: "b@x.com" },
      ]),
    ).toThrow(/personKind/)
  })

  it("rejects invalid email", () => {
    expect(() =>
      handlers.validatePublishRecipients([
        { personKind: "talent", name: "A", email: "not-an-email" },
      ]),
    ).toThrow(/not a valid email/)
  })

  it("rejects missing name", () => {
    expect(() =>
      handlers.validatePublishRecipients([
        { personKind: "talent", email: "a@example.test" },
      ]),
    ).toThrow(/name/)
  })

  it("accepts all four personKind values", () => {
    const result = handlers.validatePublishRecipients([
      { personKind: "talent", name: "A", email: "a@x.com" },
      { personKind: "crew", name: "B", email: "b@x.com" },
      { personKind: "client", name: "C", email: "c@x.com" },
      { personKind: "adhoc", name: "D", email: "d@x.com" },
    ])
    expect(result.map((r) => r.personKind)).toEqual([
      "talent",
      "crew",
      "client",
      "adhoc",
    ])
  })

  it("preserves optional fields when present", () => {
    const [result] = handlers.validatePublishRecipients([
      {
        personKind: "talent",
        name: "Alex",
        email: "alex@x.com",
        personId: "tal1",
        phone: "555-1234",
        roleLabel: "Lead",
        callTime: "7:00 AM",
        precallTime: "6:00 AM",
      },
    ])
    expect(result!.personId).toBe("tal1")
    expect(result!.phone).toBe("555-1234")
    expect(result!.roleLabel).toBe("Lead")
    expect(result!.callTime).toBe("7:00 AM")
    expect(result!.precallTime).toBe("6:00 AM")
  })

  it("normalizes empty/whitespace optionals to null", () => {
    const [result] = handlers.validatePublishRecipients([
      {
        personKind: "talent",
        name: "Alex",
        email: "a@x.com",
        personId: "   ",
        phone: "",
        roleLabel: "   ",
      },
    ])
    expect(result!.personId).toBeNull()
    expect(result!.phone).toBeNull()
    expect(result!.roleLabel).toBeNull()
  })
})

describe("VIEW_RATE_LIMIT_MS", () => {
  it("matches plan §4.3 (10 seconds)", () => {
    expect(handlers.VIEW_RATE_LIMIT_MS).toBe(10_000)
  })
})
