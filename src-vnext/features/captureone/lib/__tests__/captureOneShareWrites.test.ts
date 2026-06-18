import { beforeEach, describe, expect, it, vi } from "vitest"

const getDocsMock = vi.fn()
const updateDocMock = vi.fn()
const docMock = vi.fn((...segments: unknown[]) => ({ __doc: segments.slice(1) }))
const queryMock = vi.fn((...args: unknown[]) => ({ __query: args }))
const whereMock = vi.fn((field: string, op: string, value: unknown) => ({ field, op, value }))
const resolveMock = vi.fn()

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((..._args: unknown[]) => ({ __col: true })),
  doc: (...args: unknown[]) => docMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(args[0] as string, args[1] as string, args[2]),
  updateDoc: (...args: unknown[]) => updateDocMock(...args),
  setDoc: vi.fn(),
  serverTimestamp: () => "MOCK_TS",
}))

vi.mock("@/shared/lib/firebase", () => ({ db: { __fake: true } }))

vi.mock("@/shared/lib/paths", () => ({
  captureOneSharesPath: () => ["captureOneShares"],
  captureOneShareDocPath: (token: string) => ["captureOneShares", token],
}))

vi.mock("@/features/captureone/lib/resolveCaptureOneForShare", () => ({
  resolveCaptureOneForShare: (...args: unknown[]) => resolveMock(...args),
}))

import { refreshCaptureOneSharesForProject } from "@/features/captureone/lib/captureOneShareWrites"

function shareDoc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data }
}

describe("refreshCaptureOneSharesForProject", () => {
  beforeEach(() => {
    getDocsMock.mockReset()
    updateDocMock.mockReset().mockResolvedValue(undefined)
    docMock.mockClear()
    queryMock.mockClear()
    whereMock.mockClear()
    resolveMock.mockReset()
  })

  it("re-resolves and updates only enabled shares, with each share's own shotIds", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        shareDoc("share-all", { enabled: true, shotIds: null }),
        shareDoc("share-scoped", { enabled: true, shotIds: ["s1", "s2"] }),
        shareDoc("share-off", { enabled: false, shotIds: null }),
      ],
    })
    resolveMock.mockImplementation(async (_c: string, _p: string, shotIds: unknown) => ({
      projectName: "Proj",
      shots: [{ id: "s1", shotNumber: "1", title: "Look", filenames: [{ name: "M_Tee_Forest", genderResolved: true }] }],
      __scope: shotIds,
    }))

    await refreshCaptureOneSharesForProject({ clientId: "client-1", projectId: "proj-1" })

    // Disabled share skipped; both enabled shares resolved + updated.
    expect(resolveMock).toHaveBeenCalledTimes(2)
    expect(resolveMock).toHaveBeenCalledWith("client-1", "proj-1", null)
    expect(resolveMock).toHaveBeenCalledWith("client-1", "proj-1", ["s1", "s2"])
    expect(updateDocMock).toHaveBeenCalledTimes(2)

    const payloads = updateDocMock.mock.calls.map((c) => c[1] as Record<string, unknown>)
    for (const payload of payloads) {
      expect(payload.projectName).toBe("Proj")
      expect(Array.isArray(payload.shots)).toBe(true)
      expect(payload).not.toHaveProperty("clientId") // refresh patches only the denormalized fields
    }
  })

  it("queries by clientId + projectId (reusing the shared index, enabled filtered client-side)", async () => {
    getDocsMock.mockResolvedValue({ docs: [] })

    await refreshCaptureOneSharesForProject({ clientId: "client-1", projectId: "proj-1" })

    const wheres = whereMock.mock.calls.map((c) => `${c[0]}${c[1]}${String(c[2])}`)
    expect(wheres).toContain("clientId==client-1")
    expect(wheres).toContain("projectId==proj-1")
    expect(wheres).not.toContain("enabled==true") // enabled is NOT a query filter
    expect(updateDocMock).not.toHaveBeenCalled()
  })

  it("returns early without querying when clientId or projectId is missing", async () => {
    await refreshCaptureOneSharesForProject({ clientId: "", projectId: "proj-1" })
    await refreshCaptureOneSharesForProject({ clientId: "client-1", projectId: "" })
    expect(getDocsMock).not.toHaveBeenCalled()
  })

  it("isolates a single share failure (allSettled) so the rest still refresh", async () => {
    getDocsMock.mockResolvedValue({
      docs: [
        shareDoc("share-bad", { enabled: true, shotIds: null }),
        shareDoc("share-good", { enabled: true, shotIds: null }),
      ],
    })
    resolveMock
      .mockRejectedValueOnce(new Error("resolve blew up"))
      .mockResolvedValueOnce({ projectName: "Proj", shots: [] })

    // Does not throw despite one share rejecting.
    await expect(
      refreshCaptureOneSharesForProject({ clientId: "client-1", projectId: "proj-1" }),
    ).resolves.toBeUndefined()
    expect(updateDocMock).toHaveBeenCalledTimes(1) // only the good share updated
  })
})
