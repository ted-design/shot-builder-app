// Phase 5d — addTalentToProject auto-repair gate.
// The TalentPicker auto-repair effect calls addTalentToProject for ANY
// signed-in user with an orphaned talent link, but the backing rule
// (firestore.rules /clients/{clientId}/talent) is GLOBAL isAdmin()||isProducer().
// These specs pin (1) the global-claim gate that keeps non-admin/producer
// users from firing the org-scoped write at all, and (2) the on-denied memo
// that stops a rules-denied repair from ever retrying for the same
// client/project pair.
import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockBatchUpdate = vi.fn()
const mockBatchCommit = vi.fn()
const mockWriteBatch = vi.fn(() => ({
  update: mockBatchUpdate,
  commit: mockBatchCommit,
}))
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))

vi.mock("firebase/firestore", async () => {
  const actual =
    await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    doc: (...args: unknown[]) => mockDoc(...args),
    writeBatch: (...args: unknown[]) => mockWriteBatch(...(args as [])),
    arrayUnion: (value: unknown) => `UNION:${String(value)}`,
    serverTimestamp: () => "SERVER_TS",
  }
})

/** Mutable holder so each spec can swap the signed-in user's claims. */
const authMock = vi.hoisted(() => ({
  currentUser: null as {
    getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>
  } | null,
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {}, auth: authMock }))

vi.mock("@/shared/lib/paths", () => ({
  talentPath: (clientId: string) => ["clients", clientId, "talent"],
  locationsPath: (clientId: string) => ["clients", clientId, "locations"],
  crewPath: (clientId: string) => ["clients", clientId, "crew"],
}))

import {
  addTalentToProject,
  resetDeniedTalentLinkMemoForTests,
} from "./projectAssetsWrites"

// ---- Helpers ----

function signInWithRole(role: string | undefined) {
  authMock.currentUser = {
    getIdTokenResult: vi.fn().mockResolvedValue({
      claims: role === undefined ? {} : { role },
    }),
  }
}

function permissionDenied() {
  return Object.assign(new Error("Missing or insufficient permissions."), {
    code: "permission-denied",
  })
}

const OPTS = { clientId: "c1", projectId: "p1", ids: ["t-1", "t-2"] } as const

describe("addTalentToProject — global-claim gate", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeniedTalentLinkMemoForTests()
    mockBatchCommit.mockResolvedValue(undefined)
    signInWithRole("producer")
  })

  it("writes the arrayUnion batch for a global producer", async () => {
    await addTalentToProject(OPTS)

    expect(mockWriteBatch).toHaveBeenCalledTimes(1)
    expect(mockBatchUpdate).toHaveBeenCalledTimes(2)
    expect(mockBatchUpdate).toHaveBeenCalledWith("clients/c1/talent/t-1", {
      projectIds: "UNION:p1",
      updatedAt: "SERVER_TS",
    })
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  it("writes for a global admin", async () => {
    signInWithRole("admin")
    await addTalentToProject(OPTS)
    expect(mockBatchCommit).toHaveBeenCalledTimes(1)
  })

  // firestore.rules:21-35 accepts case variants ('Admin'/'ADMIN'/'Producer'/
  // 'PRODUCER') and AuthProvider normalizes the same claim via normalizeRole,
  // so the gate must normalize too — a raw-equality compare would silently
  // no-op the EXPLICIT Add action for these legit users.
  it.each(["Admin", "ADMIN", "Producer", "PRODUCER", " producer "])(
    "writes for case-variant global claim %j (rules accept it; gate must too)",
    async (role) => {
      signInWithRole(role)
      await addTalentToProject(OPTS)
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    },
  )

  // Warehouse/wardrobe: rules isProducer() (firestore.rules:28-35) would
  // PERMIT this write, but the gate intentionally stays stricter-than-rule,
  // matching ProjectAssetsPage's canEdit convention (fail-toward-fewer).
  it.each(["crew", "viewer", "warehouse", "Warehouse", "wardrobe", "WARDROBE"])(
    "silently no-ops for global %s (gate is deliberately stricter than rules)",
    async (role) => {
      signInWithRole(role)
      await expect(addTalentToProject(OPTS)).resolves.toBeUndefined()
      expect(mockWriteBatch).not.toHaveBeenCalled()
      expect(mockBatchCommit).not.toHaveBeenCalled()
    },
  )

  it("no-ops when the claim is missing entirely", async () => {
    signInWithRole(undefined)
    await addTalentToProject(OPTS)
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })

  it("no-ops when no user is signed in", async () => {
    authMock.currentUser = null
    await addTalentToProject(OPTS)
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })

  it("no-ops (fails toward not writing) when the token read rejects", async () => {
    authMock.currentUser = {
      getIdTokenResult: vi.fn().mockRejectedValue(new Error("token boom")),
    }
    await expect(addTalentToProject(OPTS)).resolves.toBeUndefined()
    expect(mockWriteBatch).not.toHaveBeenCalled()
  })
})

describe("addTalentToProject — permission-denied memo", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetDeniedTalentLinkMemoForTests()
    signInWithRole("producer")
  })

  it("propagates the first denial, then never retries the same client/project", async () => {
    mockBatchCommit.mockRejectedValueOnce(permissionDenied())

    await expect(addTalentToProject(OPTS)).rejects.toMatchObject({
      code: "permission-denied",
    })
    expect(mockWriteBatch).toHaveBeenCalledTimes(1)

    // The repair effect retries on the next render cycle — must be a no-op.
    mockBatchCommit.mockResolvedValue(undefined)
    await expect(addTalentToProject(OPTS)).resolves.toBeUndefined()
    expect(mockWriteBatch).toHaveBeenCalledTimes(1)
  })

  it("scopes the memo per client/project — a different project still writes", async () => {
    mockBatchCommit.mockRejectedValueOnce(permissionDenied())
    await expect(addTalentToProject(OPTS)).rejects.toMatchObject({
      code: "permission-denied",
    })

    mockBatchCommit.mockResolvedValue(undefined)
    await addTalentToProject({ ...OPTS, projectId: "p2" })
    expect(mockWriteBatch).toHaveBeenCalledTimes(2)
  })

  it("does NOT memo transient (non-denied) failures — a retry writes again", async () => {
    mockBatchCommit.mockRejectedValueOnce(
      Object.assign(new Error("unavailable"), { code: "unavailable" }),
    )
    await expect(addTalentToProject(OPTS)).rejects.toMatchObject({
      code: "unavailable",
    })

    mockBatchCommit.mockResolvedValue(undefined)
    await addTalentToProject(OPTS)
    expect(mockWriteBatch).toHaveBeenCalledTimes(2)
  })
})
