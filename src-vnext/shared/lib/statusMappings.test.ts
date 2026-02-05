import { describe, it, expect } from "vitest"
import {
  getShotStatusLabel,
  getShotStatusColor,
  getShotStatusMapping,
  shotLabelToFirestore,
  getPullStatusLabel,
  getPullStatusColor,
  pullLabelToFirestore,
  getFulfillmentStatusLabel,
  getFulfillmentStatusColor,
  fulfillmentLabelToFirestore,
  SHOT_STATUSES,
  PULL_STATUSES,
  FULFILLMENT_STATUSES,
} from "./statusMappings"

describe("Shot Status Mappings", () => {
  it("maps all Firestore values to labels", () => {
    expect(getShotStatusLabel("todo")).toBe("Draft")
    expect(getShotStatusLabel("in_progress")).toBe("In Progress")
    expect(getShotStatusLabel("complete")).toBe("Shot")
    expect(getShotStatusLabel("on_hold")).toBe("On Hold")
  })

  it("maps all Firestore values to colors", () => {
    expect(getShotStatusColor("todo")).toBe("gray")
    expect(getShotStatusColor("in_progress")).toBe("blue")
    expect(getShotStatusColor("complete")).toBe("green")
    expect(getShotStatusColor("on_hold")).toBe("amber")
  })

  it("returns full mapping object", () => {
    const mapping = getShotStatusMapping("complete")
    expect(mapping).toEqual({
      firestoreValue: "complete",
      label: "Shot",
      color: "green",
    })
  })

  it("falls back for unknown status", () => {
    expect(getShotStatusLabel("unknown" as never)).toBe("unknown")
    expect(getShotStatusColor("unknown" as never)).toBe("gray")
  })

  it("converts label back to Firestore value", () => {
    expect(shotLabelToFirestore("Draft")).toBe("todo")
    expect(shotLabelToFirestore("In Progress")).toBe("in_progress")
    expect(shotLabelToFirestore("Shot")).toBe("complete")
    expect(shotLabelToFirestore("On Hold")).toBe("on_hold")
  })

  it("converts label case-insensitively", () => {
    expect(shotLabelToFirestore("draft")).toBe("todo")
    expect(shotLabelToFirestore("IN PROGRESS")).toBe("in_progress")
  })

  it("falls back to 'todo' for unknown label", () => {
    expect(shotLabelToFirestore("invalid")).toBe("todo")
  })

  it("has 4 shot statuses", () => {
    expect(SHOT_STATUSES).toHaveLength(4)
  })

  it("round-trips all shot statuses label→firestore→label", () => {
    for (const status of SHOT_STATUSES) {
      const firestoreVal = shotLabelToFirestore(status.label)
      const roundTripped = getShotStatusLabel(firestoreVal)
      expect(roundTripped).toBe(status.label)
    }
  })
})

describe("Pull Status Mappings", () => {
  it("maps all Firestore values to labels", () => {
    expect(getPullStatusLabel("draft")).toBe("Draft")
    expect(getPullStatusLabel("published")).toBe("Published")
    expect(getPullStatusLabel("in-progress")).toBe("In Progress")
    expect(getPullStatusLabel("fulfilled")).toBe("Fulfilled")
  })

  it("maps all Firestore values to colors", () => {
    expect(getPullStatusColor("draft")).toBe("gray")
    expect(getPullStatusColor("published")).toBe("blue")
    expect(getPullStatusColor("in-progress")).toBe("blue")
    expect(getPullStatusColor("fulfilled")).toBe("green")
  })

  it("converts label back to Firestore value", () => {
    expect(pullLabelToFirestore("Draft")).toBe("draft")
    expect(pullLabelToFirestore("Published")).toBe("published")
    expect(pullLabelToFirestore("In Progress")).toBe("in-progress")
    expect(pullLabelToFirestore("Fulfilled")).toBe("fulfilled")
  })

  it("has 4 pull statuses", () => {
    expect(PULL_STATUSES).toHaveLength(4)
  })

  it("round-trips all pull statuses", () => {
    for (const status of PULL_STATUSES) {
      const firestoreVal = pullLabelToFirestore(status.label)
      const roundTripped = getPullStatusLabel(firestoreVal)
      expect(roundTripped).toBe(status.label)
    }
  })
})

describe("Fulfillment Status Mappings", () => {
  it("maps all Firestore values to labels", () => {
    expect(getFulfillmentStatusLabel("pending")).toBe("Pending")
    expect(getFulfillmentStatusLabel("fulfilled")).toBe("Fulfilled")
    expect(getFulfillmentStatusLabel("partial")).toBe("Partial")
    expect(getFulfillmentStatusLabel("substituted")).toBe("Substituted")
  })

  it("maps all Firestore values to colors", () => {
    expect(getFulfillmentStatusColor("pending")).toBe("gray")
    expect(getFulfillmentStatusColor("fulfilled")).toBe("green")
    expect(getFulfillmentStatusColor("partial")).toBe("amber")
    expect(getFulfillmentStatusColor("substituted")).toBe("blue")
  })

  it("converts label back to Firestore value", () => {
    expect(fulfillmentLabelToFirestore("Pending")).toBe("pending")
    expect(fulfillmentLabelToFirestore("Fulfilled")).toBe("fulfilled")
    expect(fulfillmentLabelToFirestore("Partial")).toBe("partial")
    expect(fulfillmentLabelToFirestore("Substituted")).toBe("substituted")
  })

  it("has 4 fulfillment statuses", () => {
    expect(FULFILLMENT_STATUSES).toHaveLength(4)
  })

  it("round-trips all fulfillment statuses", () => {
    for (const status of FULFILLMENT_STATUSES) {
      const firestoreVal = fulfillmentLabelToFirestore(status.label)
      const roundTripped = getFulfillmentStatusLabel(firestoreVal)
      expect(roundTripped).toBe(status.label)
    }
  })
})
