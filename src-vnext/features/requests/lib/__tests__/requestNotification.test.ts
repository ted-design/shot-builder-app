/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockCallFunction = vi.fn()
const mockAddDoc = vi.fn()
const mockCollection = vi.fn(() => ({ _type: "collection" }))
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }))

vi.mock("@/shared/lib/callFunction", () => ({
  callFunction: (...args: unknown[]) => mockCallFunction(...args),
}))

vi.mock("firebase/firestore", () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestsPath: (clientId: string) => ["clients", clientId, "shotRequests"],
  shotRequestCommentsPath: (clientId: string, requestId: string) => [
    "clients", clientId, "shotRequests", requestId, "comments",
  ],
  projectMemberDocPath: vi.fn(),
  projectsPath: vi.fn(),
  shotRequestDocPath: vi.fn(),
  shotsPath: vi.fn(),
}))

import { submitShotRequest } from "../requestWrites"

describe("submitShotRequest — notification trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddDoc.mockResolvedValue({ id: "new-req-id" })
    mockCallFunction.mockResolvedValue({ notified: 2 })
  })

  it("calls callFunction('sendRequestNotification') after successful write", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "Spring Campaign",
      priority: "normal",
      submittedBy: "uid-1",
    })

    // Allow the fire-and-forget promise to settle
    await new Promise((r) => setTimeout(r, 0))

    expect(mockCallFunction).toHaveBeenCalledWith("sendRequestNotification", {
      requestId: "new-req-id",
      clientId: "c1",
    })
  })

  it("writes notifyUserIds to the Firestore document", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "Hero Shots",
      priority: "urgent",
      submittedBy: "uid-1",
      notifyUserIds: ["uid-admin", "uid-prod"],
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        notifyUserIds: ["uid-admin", "uid-prod"],
      }),
    )
  })

  it("writes null notifyUserIds when not provided", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "Normal Request",
      priority: "normal",
      submittedBy: "uid-1",
    })

    expect(mockAddDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        notifyUserIds: null,
      }),
    )
  })

  it("does not throw when callFunction rejects (fire-and-forget)", async () => {
    mockCallFunction.mockRejectedValue(new Error("network error"))

    await expect(
      submitShotRequest({
        clientId: "c1",
        title: "Resilient Request",
        priority: "normal",
        submittedBy: "uid-1",
      }),
    ).resolves.toBe("new-req-id")

    // Let async rejection settle without unhandled rejection
    await new Promise((r) => setTimeout(r, 0))
  })

  it("returns the new document id", async () => {
    mockAddDoc.mockResolvedValue({ id: "generated-id" })

    const id = await submitShotRequest({
      clientId: "c1",
      title: "Test",
      priority: "normal",
      submittedBy: "uid-1",
    })

    expect(id).toBe("generated-id")
  })
})
