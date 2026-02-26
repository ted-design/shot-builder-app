import { describe, expect, it } from "vitest"
import { formatFieldNames, formatActiveEditorsSummary, type ActiveEditor } from "./presence"
import type { Timestamp } from "firebase/firestore"

const ts = { toDate: () => new Date() } as unknown as Timestamp

function makeEditor(overrides: Partial<ActiveEditor> = {}): ActiveEditor {
  return {
    userId: "u1",
    userName: "Alice",
    userAvatar: null,
    fields: ["title"],
    lastActivity: ts,
    ...overrides,
  }
}

describe("formatFieldNames", () => {
  it("returns empty string for empty array", () => {
    expect(formatFieldNames([])).toBe("")
  })

  it("returns single field label", () => {
    expect(formatFieldNames(["name"])).toBe("Name")
  })

  it("joins two fields with 'and'", () => {
    expect(formatFieldNames(["name", "description"])).toBe("Name and Description")
  })

  it("uses Oxford comma for 3+ fields", () => {
    expect(formatFieldNames(["name", "description", "notes"])).toBe(
      "Name, Description, and Notes",
    )
  })

  it("uses raw field name when no label mapping", () => {
    expect(formatFieldNames(["customField"])).toBe("customField")
  })
})

describe("formatActiveEditorsSummary", () => {
  it("returns empty string for empty array", () => {
    expect(formatActiveEditorsSummary([])).toBe("")
  })

  it("describes single editor with field", () => {
    expect(formatActiveEditorsSummary([makeEditor({ fields: ["name"] })])).toBe(
      "Alice is editing Name",
    )
  })

  it("describes two editors", () => {
    expect(
      formatActiveEditorsSummary([
        makeEditor({ userName: "Alice" }),
        makeEditor({ userId: "u2", userName: "Bob" }),
      ]),
    ).toBe("Alice and Bob are editing")
  })

  it("describes 3+ editors with count", () => {
    expect(
      formatActiveEditorsSummary([
        makeEditor({ userName: "Alice" }),
        makeEditor({ userId: "u2", userName: "Bob" }),
        makeEditor({ userId: "u3", userName: "Carol" }),
      ]),
    ).toBe("Alice and 2 others are editing")
  })
})
