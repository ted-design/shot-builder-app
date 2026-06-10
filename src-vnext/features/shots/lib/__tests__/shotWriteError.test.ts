// Phase 5b — shared permission-denied branch for shot-write toasts.
import { describe, it, expect } from "vitest"
import { FirebaseError } from "firebase/app"
import {
  isShotPermissionDenied,
  shotWriteErrorDescription,
  SHOT_PERMISSION_DENIED_DESCRIPTION,
} from "@/features/shots/lib/shotWriteError"

describe("isShotPermissionDenied", () => {
  it("matches a FirebaseError with code permission-denied", () => {
    const err = new FirebaseError("permission-denied", "Missing or insufficient permissions.")
    expect(isShotPermissionDenied(err)).toBe(true)
  })

  it("rejects other FirebaseError codes", () => {
    expect(isShotPermissionDenied(new FirebaseError("unavailable", "down"))).toBe(false)
  })

  it("string-matches plain Errors carrying Firestore's message (ProjectActionsMenu precedent)", () => {
    expect(
      isShotPermissionDenied(new Error("FirebaseError: Missing or insufficient permissions.")),
    ).toBe(true)
    expect(isShotPermissionDenied(new Error("network down"))).toBe(false)
  })

  it("rejects non-Error values", () => {
    expect(isShotPermissionDenied("permission-denied")).toBe(false)
    expect(isShotPermissionDenied(null)).toBe(false)
  })
})

describe("shotWriteErrorDescription", () => {
  it("returns the 5b permission copy on a denial", () => {
    const err = new FirebaseError("permission-denied", "Missing or insufficient permissions.")
    expect(shotWriteErrorDescription(err, "fallback")).toBe(
      SHOT_PERMISSION_DENIED_DESCRIPTION,
    )
    expect(SHOT_PERMISSION_DENIED_DESCRIPTION).toBe(
      "You don't have permission to edit shots on this project.",
    )
  })

  it("returns the caller fallback (or undefined) otherwise", () => {
    expect(shotWriteErrorDescription(new Error("boom"), "fallback")).toBe("fallback")
    expect(shotWriteErrorDescription(new Error("boom"))).toBeUndefined()
  })
})
