import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockAddDoc = vi.fn()
const mockRunTransaction = vi.fn()
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))
const mockCollection = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    doc: (...args: unknown[]) => mockDoc(...args),
    collection: (...args: unknown[]) => mockCollection(...args),
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    runTransaction: (...args: unknown[]) => mockRunTransaction(...args),
    serverTimestamp: () => "SERVER_TS",
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/shared/lib/paths", () => ({
  shotRequestsPath: (clientId: string) => ["clients", clientId, "shotRequests"],
  shotRequestDocPath: (requestId: string, clientId: string) => [
    "clients", clientId, "shotRequests", requestId,
  ],
  shotsPath: (clientId: string) => ["clients", clientId, "shots"],
}))

import {
  submitShotRequest,
  triageAbsorbRequest,
  triageRejectRequest,
} from "./requestWrites"

describe("submitShotRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddDoc.mockResolvedValue({ id: "new-req-id" })
  })

  it("calls addDoc with correct collection path", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "Hero shot needed",
      priority: "normal",
      submittedBy: "user-1",
    })

    expect(mockCollection).toHaveBeenCalledWith({}, "clients", "c1", "shotRequests")
    expect(mockAddDoc).toHaveBeenCalledTimes(1)
  })

  it("writes correct document shape", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "  Hero shot needed  ",
      priority: "urgent",
      description: "Full body shot",
      referenceUrls: ["https://example.com/ref.jpg"],
      deadline: "2026-03-15",
      notes: "Urgent for campaign",
      submittedBy: "user-1",
      submittedByName: "Jane Doe",
    })

    const [, data] = mockAddDoc.mock.calls[0]!
    expect(data.clientId).toBe("c1")
    expect(data.status).toBe("submitted")
    expect(data.priority).toBe("urgent")
    expect(data.title).toBe("Hero shot needed")
    expect(data.description).toBe("Full body shot")
    expect(data.referenceUrls).toEqual(["https://example.com/ref.jpg"])
    expect(data.deadline).toBe("2026-03-15")
    expect(data.notes).toBe("Urgent for campaign")
    expect(data.submittedBy).toBe("user-1")
    expect(data.submittedByName).toBe("Jane Doe")
    expect(data.submittedAt).toBe("SERVER_TS")
    expect(data.updatedAt).toBe("SERVER_TS")
  })

  it("defaults optional fields to null", async () => {
    await submitShotRequest({
      clientId: "c1",
      title: "Basic request",
      priority: "normal",
      submittedBy: "user-1",
    })

    const [, data] = mockAddDoc.mock.calls[0]!
    expect(data.description).toBeNull()
    expect(data.referenceUrls).toBeNull()
    expect(data.deadline).toBeNull()
    expect(data.notes).toBeNull()
    expect(data.submittedByName).toBeNull()
  })

  it("returns the new document id", async () => {
    const result = await submitShotRequest({
      clientId: "c1",
      title: "Test",
      priority: "normal",
      submittedBy: "user-1",
    })

    expect(result).toBe("new-req-id")
  })

  it("propagates Firestore errors", async () => {
    mockAddDoc.mockRejectedValue(new Error("permission-denied"))

    await expect(
      submitShotRequest({
        clientId: "c1",
        title: "Test",
        priority: "normal",
        submittedBy: "user-1",
      }),
    ).rejects.toThrow("permission-denied")
  })
})

describe("triageAbsorbRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("calls runTransaction", async () => {
    mockRunTransaction.mockResolvedValue("new-shot-id")

    await triageAbsorbRequest({
      requestId: "r1",
      clientId: "c1",
      projectId: "p1",
      triagedBy: "admin-1",
    })

    expect(mockRunTransaction).toHaveBeenCalledTimes(1)
    expect(mockRunTransaction).toHaveBeenCalledWith({}, expect.any(Function))
  })

  it("builds correct request doc path", async () => {
    mockRunTransaction.mockResolvedValue("new-shot-id")

    await triageAbsorbRequest({
      requestId: "r1",
      clientId: "c1",
      projectId: "p1",
      triagedBy: "admin-1",
    })

    expect(mockDoc).toHaveBeenCalledWith({}, "clients", "c1", "shotRequests", "r1")
  })

  it("builds correct shots collection path", async () => {
    mockRunTransaction.mockResolvedValue("new-shot-id")

    await triageAbsorbRequest({
      requestId: "r1",
      clientId: "c1",
      projectId: "p1",
      triagedBy: "admin-1",
    })

    expect(mockCollection).toHaveBeenCalledWith({}, "clients", "c1", "shots")
  })

  it("returns the new shot id", async () => {
    mockRunTransaction.mockResolvedValue("new-shot-id")

    const result = await triageAbsorbRequest({
      requestId: "r1",
      clientId: "c1",
      projectId: "p1",
      triagedBy: "admin-1",
    })

    expect(result).toBe("new-shot-id")
  })

  it("propagates transaction errors", async () => {
    mockRunTransaction.mockRejectedValue(new Error("Request not found"))

    await expect(
      triageAbsorbRequest({
        requestId: "r1",
        clientId: "c1",
        projectId: "p1",
        triagedBy: "admin-1",
      }),
    ).rejects.toThrow("Request not found")
  })
})

describe("triageRejectRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRunTransaction.mockResolvedValue(undefined)
  })

  it("calls runTransaction", async () => {
    await triageRejectRequest({
      requestId: "r1",
      clientId: "c1",
      triagedBy: "admin-1",
      rejectionReason: "Out of scope",
    })

    expect(mockRunTransaction).toHaveBeenCalledTimes(1)
    expect(mockRunTransaction).toHaveBeenCalledWith({}, expect.any(Function))
  })

  it("builds correct request doc path", async () => {
    await triageRejectRequest({
      requestId: "r1",
      clientId: "c1",
      triagedBy: "admin-1",
    })

    expect(mockDoc).toHaveBeenCalledWith({}, "clients", "c1", "shotRequests", "r1")
  })

  it("propagates transaction errors", async () => {
    mockRunTransaction.mockRejectedValue(new Error("not-found"))

    await expect(
      triageRejectRequest({
        requestId: "r1",
        clientId: "c1",
        triagedBy: "admin-1",
      }),
    ).rejects.toThrow("not-found")
  })
})
