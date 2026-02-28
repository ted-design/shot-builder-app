import { describe, it, expect } from "vitest"
import {
  REQUEST_STATUSES,
  getRequestStatusLabel,
  getRequestStatusColor,
  getRequestStatusMapping,
} from "./requestStatusMappings"
import type { ShotRequestStatus } from "@/shared/types"

describe("Request Status Mappings", () => {
  describe("REQUEST_STATUSES", () => {
    it("has 4 statuses", () => {
      expect(REQUEST_STATUSES).toHaveLength(4)
    })

    it("includes all status values", () => {
      const values = REQUEST_STATUSES.map((s) => s.firestoreValue)
      expect(values).toContain("submitted")
      expect(values).toContain("triaged")
      expect(values).toContain("absorbed")
      expect(values).toContain("rejected")
    })
  })

  describe("getRequestStatusLabel", () => {
    it("returns Submitted for submitted", () => {
      expect(getRequestStatusLabel("submitted")).toBe("Submitted")
    })

    it("returns Triaged for triaged", () => {
      expect(getRequestStatusLabel("triaged")).toBe("Triaged")
    })

    it("returns Absorbed for absorbed", () => {
      expect(getRequestStatusLabel("absorbed")).toBe("Absorbed")
    })

    it("returns Rejected for rejected", () => {
      expect(getRequestStatusLabel("rejected")).toBe("Rejected")
    })

    it("falls back to raw value for unknown status", () => {
      expect(getRequestStatusLabel("unknown" as ShotRequestStatus)).toBe("unknown")
    })
  })

  describe("getRequestStatusColor", () => {
    it("returns blue for submitted", () => {
      expect(getRequestStatusColor("submitted")).toBe("blue")
    })

    it("returns amber for triaged", () => {
      expect(getRequestStatusColor("triaged")).toBe("amber")
    })

    it("returns green for absorbed", () => {
      expect(getRequestStatusColor("absorbed")).toBe("green")
    })

    it("returns gray for rejected", () => {
      expect(getRequestStatusColor("rejected")).toBe("gray")
    })

    it("falls back to gray for unknown status", () => {
      expect(getRequestStatusColor("unknown" as ShotRequestStatus)).toBe("gray")
    })
  })

  describe("getRequestStatusMapping", () => {
    it("returns full mapping for submitted", () => {
      const mapping = getRequestStatusMapping("submitted")
      expect(mapping).toEqual({
        firestoreValue: "submitted",
        label: "Submitted",
        color: "blue",
      })
    })

    it("returns full mapping for triaged", () => {
      const mapping = getRequestStatusMapping("triaged")
      expect(mapping).toEqual({
        firestoreValue: "triaged",
        label: "Triaged",
        color: "amber",
      })
    })

    it("returns full mapping for absorbed", () => {
      const mapping = getRequestStatusMapping("absorbed")
      expect(mapping).toEqual({
        firestoreValue: "absorbed",
        label: "Absorbed",
        color: "green",
      })
    })

    it("returns full mapping for rejected", () => {
      const mapping = getRequestStatusMapping("rejected")
      expect(mapping).toEqual({
        firestoreValue: "rejected",
        label: "Rejected",
        color: "gray",
      })
    })

    it("falls back to submitted mapping for unknown status", () => {
      const mapping = getRequestStatusMapping("unknown" as ShotRequestStatus)
      expect(mapping.firestoreValue).toBe("submitted")
    })
  })
})
