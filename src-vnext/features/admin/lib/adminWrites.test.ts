import { describe, it, expect, vi, beforeEach } from "vitest"

// ---- Mocks ----

const mockCallable = vi.fn()
const mockHttpsCallable = vi.fn(() => mockCallable)
const mockSetDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockDoc = vi.fn((_db: unknown, ...segments: string[]) => segments.join("/"))

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}))

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    doc: (...args: unknown[]) => mockDoc(...args),
    setDoc: (...args: unknown[]) => mockSetDoc(...args),
    deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
    serverTimestamp: () => "SERVER_TS",
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {}, functions: {} }))

vi.mock("@/shared/lib/paths", () => ({
  userDocPath: (uid: string, clientId: string) => ["clients", clientId, "users", uid],
  projectMemberDocPath: (userId: string, projectId: string, clientId: string) => [
    "clients", clientId, "projects", projectId, "members", userId,
  ],
}))

import {
  inviteOrUpdateUser,
  updateUserRole,
  addProjectMember,
  removeProjectMember,
} from "./adminWrites"

// ---- Helpers ----

function makeCallableResponse(uid: string) {
  return { data: { ok: true, uid, claims: { role: "producer", clientId: "c1" } } }
}

describe("inviteOrUpdateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallable.mockResolvedValue(makeCallableResponse("uid-abc"))
    mockSetDoc.mockResolvedValue(undefined)
  })

  it("calls setUserClaims CF with correct arguments", async () => {
    await inviteOrUpdateUser({
      targetEmail: "user@example.com",
      displayName: "Jane Doe",
      role: "producer",
      clientId: "c1",
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith({}, "setUserClaims")
    expect(mockCallable).toHaveBeenCalledWith({
      targetEmail: "user@example.com",
      role: "producer",
      clientId: "c1",
    })
  })

  it("writes user doc after CF call with mergeFields", async () => {
    await inviteOrUpdateUser({
      targetEmail: "user@example.com",
      displayName: "Jane Doe",
      role: "producer",
      clientId: "c1",
    })

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [_ref, data, options] = mockSetDoc.mock.calls[0]!
    expect(data.email).toBe("user@example.com")
    expect(data.displayName).toBe("Jane Doe")
    expect(data.role).toBe("producer")
    expect(data.updatedAt).toBe("SERVER_TS")
    expect(options.mergeFields).toContain("email")
    expect(options.mergeFields).toContain("role")
  })

  it("stores null displayName when empty string is provided", async () => {
    await inviteOrUpdateUser({
      targetEmail: "user@example.com",
      displayName: "",
      role: "admin",
      clientId: "c1",
    })

    const [_ref, data] = mockSetDoc.mock.calls[0]!
    expect(data.displayName).toBeNull()
  })

  it("returns the uid from the CF response", async () => {
    const result = await inviteOrUpdateUser({
      targetEmail: "user@example.com",
      displayName: null,
      role: "viewer",
      clientId: "c1",
    })

    expect(result).toBe("uid-abc")
  })

  it("throws when CF response has no uid", async () => {
    mockCallable.mockResolvedValue({ data: { ok: false, uid: "", claims: {} } })

    await expect(
      inviteOrUpdateUser({
        targetEmail: "user@example.com",
        displayName: null,
        role: "producer",
        clientId: "c1",
      }),
    ).rejects.toThrow("Cloud Function did not return a user id.")
  })

  it("propagates CF errors", async () => {
    mockCallable.mockRejectedValue(new Error("auth/user-not-found"))

    await expect(
      inviteOrUpdateUser({
        targetEmail: "ghost@example.com",
        displayName: null,
        role: "producer",
        clientId: "c1",
      }),
    ).rejects.toThrow("auth/user-not-found")
  })
})

describe("updateUserRole", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCallable.mockResolvedValue(makeCallableResponse("uid-xyz"))
    mockSetDoc.mockResolvedValue(undefined)
  })

  it("calls setUserClaims CF with correct arguments", async () => {
    await updateUserRole({
      userId: "uid-xyz",
      userEmail: "user@example.com",
      newRole: "admin",
      clientId: "c1",
    })

    expect(mockHttpsCallable).toHaveBeenCalledWith({}, "setUserClaims")
    expect(mockCallable).toHaveBeenCalledWith({
      targetEmail: "user@example.com",
      role: "admin",
      clientId: "c1",
    })
  })

  it("writes only role and updatedAt to Firestore with merge", async () => {
    await updateUserRole({
      userId: "uid-xyz",
      userEmail: "user@example.com",
      newRole: "crew",
      clientId: "c1",
    })

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [_ref, data, options] = mockSetDoc.mock.calls[0]!
    expect(data.role).toBe("crew")
    expect(data.updatedAt).toBe("SERVER_TS")
    expect(data.email).toBeUndefined()
    expect(options.merge).toBe(true)
  })

  it("propagates CF errors without writing Firestore", async () => {
    mockCallable.mockRejectedValue(new Error("permission-denied"))

    await expect(
      updateUserRole({
        userId: "uid-xyz",
        userEmail: "user@example.com",
        newRole: "admin",
        clientId: "c1",
      }),
    ).rejects.toThrow("permission-denied")

    expect(mockSetDoc).not.toHaveBeenCalled()
  })
})

describe("addProjectMember", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetDoc.mockResolvedValue(undefined)
  })

  it("writes member doc with role, addedAt, and addedBy", async () => {
    await addProjectMember({
      userId: "user-1",
      projectId: "proj-1",
      role: "producer",
      clientId: "c1",
      addedBy: "admin-uid",
    })

    expect(mockSetDoc).toHaveBeenCalledTimes(1)
    const [_ref, data] = mockSetDoc.mock.calls[0]!
    expect(data.role).toBe("producer")
    expect(data.addedAt).toBe("SERVER_TS")
    expect(data.addedBy).toBe("admin-uid")
  })

  it("builds correct Firestore path for member doc", async () => {
    await addProjectMember({
      userId: "user-1",
      projectId: "proj-1",
      role: "crew",
      clientId: "c1",
      addedBy: "admin-uid",
    })

    expect(mockDoc).toHaveBeenCalledWith(
      {},
      "clients",
      "c1",
      "projects",
      "proj-1",
      "members",
      "user-1",
    )
  })

  it("propagates Firestore errors", async () => {
    mockSetDoc.mockRejectedValue(new Error("permission-denied"))

    await expect(
      addProjectMember({
        userId: "user-1",
        projectId: "proj-1",
        role: "viewer",
        clientId: "c1",
        addedBy: "admin-uid",
      }),
    ).rejects.toThrow("permission-denied")
  })
})

describe("removeProjectMember", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeleteDoc.mockResolvedValue(undefined)
  })

  it("deletes the member doc", async () => {
    await removeProjectMember({
      userId: "user-1",
      projectId: "proj-1",
      clientId: "c1",
    })

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1)
  })

  it("builds correct Firestore path for deletion", async () => {
    await removeProjectMember({
      userId: "user-1",
      projectId: "proj-1",
      clientId: "c1",
    })

    expect(mockDoc).toHaveBeenCalledWith(
      {},
      "clients",
      "c1",
      "projects",
      "proj-1",
      "members",
      "user-1",
    )
  })

  it("propagates Firestore errors", async () => {
    mockDeleteDoc.mockRejectedValue(new Error("not-found"))

    await expect(
      removeProjectMember({
        userId: "user-1",
        projectId: "proj-1",
        clientId: "c1",
      }),
    ).rejects.toThrow("not-found")
  })
})
