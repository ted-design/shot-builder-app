import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

// ---- Hoisted mocks (Firestore callables + Auth) ----

const firestoreMocks = vi.hoisted(() => {
  const setDoc = vi.fn(async () => undefined)
  const updateDoc = vi.fn(async () => undefined)
  const deleteDoc = vi.fn(async () => undefined)
  const getDocs = vi.fn(async () => ({ docs: [] as unknown[] }))
  const onSnapshot = vi.fn(
    (
      _q: unknown,
      onNext: (snap: { docs: unknown[] }) => void,
      _onErr?: (e: unknown) => void,
    ) => {
      // Fire success once with empty docs so setLoading(false) runs, then return
      // an unsubscribe. The migration effect we're testing does NOT depend on
      // this firing, but keeping it realistic avoids console noise.
      try {
        onNext({ docs: [] })
      } catch {
        /* swallow — not under test */
      }
      return () => undefined
    },
  )
  // `doc(collRef)` with no id is used by the migration path. We return a
  // stable-ish ref shape; the hook only uses `.id`.
  const doc = vi.fn(() => ({ id: "generated-doc-id" }))
  const collection = vi.fn(() => ({ __type: "collectionRef" }))
  const query = vi.fn((ref: unknown) => ref)
  const orderBy = vi.fn((field: string, dir: string) => ({ field, dir }))
  const serverTimestamp = vi.fn(() => ({ __type: "serverTimestamp" }))
  return {
    setDoc,
    updateDoc,
    deleteDoc,
    getDocs,
    onSnapshot,
    doc,
    collection,
    query,
    orderBy,
    serverTimestamp,
  }
})

vi.mock("firebase/firestore", () => ({
  setDoc: firestoreMocks.setDoc,
  updateDoc: firestoreMocks.updateDoc,
  deleteDoc: firestoreMocks.deleteDoc,
  getDocs: firestoreMocks.getDocs,
  onSnapshot: firestoreMocks.onSnapshot,
  doc: firestoreMocks.doc,
  collection: firestoreMocks.collection,
  query: firestoreMocks.query,
  orderBy: firestoreMocks.orderBy,
  serverTimestamp: firestoreMocks.serverTimestamp,
}))

vi.mock("@/shared/lib/firebase", () => ({
  db: { __type: "mockDb" },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/shared/lib/paths", () => ({
  exportTemplatesPath: (clientId: string) => [
    "clients",
    clientId,
    "exportTemplates",
  ],
  exportTemplateDocPath: (clientId: string, templateId: string) => [
    "clients",
    clientId,
    "exportTemplates",
    templateId,
  ],
}))

const loadLocalStorageTemplatesMock = vi.fn<() => unknown[]>(() => [])
vi.mock("../../lib/documentPersistence", () => ({
  loadTemplates: (...args: unknown[]) => loadLocalStorageTemplatesMock(...args),
}))

vi.mock("../../lib/builtInTemplates", () => ({
  BUILT_IN_TEMPLATES: [],
}))

// ---- Imports after mocks ----

import { useAuth } from "@/app/providers/AuthProvider"
import { useExportTemplates } from "../useExportTemplates"

const mockAuth = useAuth as unknown as {
  mockReturnValue: (v: unknown) => void
}

// ---- Real Map-backed localStorage stub (mirrors documentPersistence.test.ts) ----

let storage: Map<string, string>

beforeEach(() => {
  vi.clearAllMocks()
  storage = new Map()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() {
      return storage.size
    },
    key: (index: number) => [...storage.keys()][index] ?? null,
  })

  mockAuth.mockReturnValue({ user: { uid: "test-uid" } })
  loadLocalStorageTemplatesMock.mockReturnValue([])
  firestoreMocks.getDocs.mockResolvedValue({ docs: [] })
})

describe("useExportTemplates — migration effect", () => {
  it("sets the migrated flag for an empty localStorage workspace without throwing (regression: LS_MIGRATED_KEY ReferenceError)", async () => {
    // GIVEN: signed-in user, valid clientId, empty localStorage (no legacy
    // templates, no prior migration flag). This is the production-default path
    // that every new workspace hits on first Export Builder mount.
    loadLocalStorageTemplatesMock.mockReturnValue([])

    // WHEN: the hook mounts.
    // THEN: it must not throw. Today this throws
    //   ReferenceError: LS_MIGRATED_KEY is not defined
    // at useExportTemplates.ts:112, which React surfaces out of the commit
    // phase and ErrorBoundary catches as "Something went wrong in Export".
    expect(() => {
      renderHook(() => useExportTemplates("client-abc"))
    }).not.toThrow()

    // AND: the migrated marker must be written under the per-client key so the
    // effect does not re-run on every mount.
    await waitFor(() => {
      expect(storage.get("sb:export-templates-migrated:client-abc")).toBe(
        "true",
      )
    })

    // AND: no Firestore writes should happen on the empty branch.
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
  })

  it("migrates a populated localStorage workspace to Firestore, clears the legacy key, and sets the migrated flag", async () => {
    // GIVEN: one legacy template in localStorage under the export-templates
    // key, a signed-in user, and no prior migration flag.
    const legacyTemplate = {
      id: "t-legacy-1",
      name: "Legacy Template",
      description: "Pre-Firestore template",
      category: "workspace",
      pages: [{ id: "p1", items: [] }],
      settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
    }
    loadLocalStorageTemplatesMock.mockReturnValue([legacyTemplate])
    // Seed the legacy localStorage key so we can assert it's removed post-migration.
    storage.set("sb:export-templates", JSON.stringify([legacyTemplate]))

    firestoreMocks.getDocs.mockResolvedValueOnce({ docs: [] })

    // WHEN: the hook mounts.
    renderHook(() => useExportTemplates("client-abc"))

    // THEN: the migration writes the template to Firestore.
    await waitFor(() => {
      expect(firestoreMocks.setDoc).toHaveBeenCalledTimes(1)
    })

    const [, payload] = firestoreMocks.setDoc.mock.calls[0]!
    expect(payload).toMatchObject({
      name: "Legacy Template",
      description: "Pre-Firestore template",
      createdBy: "test-uid",
    })

    // AND: the migrated marker is set and the legacy key is removed.
    await waitFor(() => {
      expect(storage.get("sb:export-templates-migrated:client-abc")).toBe(
        "true",
      )
    })
    expect(storage.has("sb:export-templates")).toBe(false)
  })

  it("no-ops when the migrated flag is already set for this client", async () => {
    // GIVEN: the migrated flag for this client already exists.
    storage.set("sb:export-templates-migrated:client-abc", "true")
    loadLocalStorageTemplatesMock.mockReturnValue([])

    // WHEN: the hook mounts.
    renderHook(() => useExportTemplates("client-abc"))

    // THEN: no Firestore write, no call into loadLocalStorageTemplates.
    // (The guard returns before loadTemplates is invoked.)
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
    expect(loadLocalStorageTemplatesMock).not.toHaveBeenCalled()
  })

  it("does nothing when clientId is null", () => {
    mockAuth.mockReturnValue({ user: { uid: "test-uid" } })

    const { result } = renderHook(() => useExportTemplates(null))

    expect(result.current.loading).toBe(false)
    expect(result.current.workspaceTemplates).toEqual([])
    expect(firestoreMocks.setDoc).not.toHaveBeenCalled()
    expect(loadLocalStorageTemplatesMock).not.toHaveBeenCalled()
  })
})
