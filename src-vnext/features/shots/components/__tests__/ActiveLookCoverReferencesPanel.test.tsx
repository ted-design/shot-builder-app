/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

const mockUpdateShotWithVersion = vi.fn(async () => undefined)

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: (args: unknown) => mockUpdateShotWithVersion(args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => "https://example.com/img.webp",
}))

vi.mock("@/shared/lib/uploadImage", () => ({
  uploadShotReferenceImage: vi.fn(),
}))

import { ActiveLookCoverReferencesPanel } from "@/features/shots/components/ActiveLookCoverReferencesPanel"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    looks: overrides.looks,
    activeLookId: overrides.activeLookId,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

describe("ActiveLookCoverReferencesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("sets displayImageId on the active look when Set as cover is clicked", async () => {
    const shot = makeShot({
      activeLookId: "look-1",
      looks: [
        {
          id: "look-1",
          order: 0,
          products: [],
          heroProductId: undefined,
          references: [
            { id: "ref-1", path: "clients/c1/shots/s1/references/ref-1.webp" },
            { id: "ref-2", path: "clients/c1/shots/s1/references/ref-2.webp" },
          ],
          displayImageId: null,
        },
      ],
    })

    render(<ActiveLookCoverReferencesPanel shot={shot} canEdit />)

    const setButtons = screen.getAllByTitle("Set as cover")
    fireEvent.click(setButtons[0]!)

    await waitFor(() => expect(mockUpdateShotWithVersion).toHaveBeenCalledTimes(1))
    const call = mockUpdateShotWithVersion.mock.calls[0]?.[0] as Record<string, unknown>
    expect(call.source).toBe("ActiveLookCoverReferencesPanel.saveLooks")

    const patch = call.patch as Record<string, unknown>
    const looks = patch.looks as Array<Record<string, unknown>>
    expect(looks[0]?.displayImageId).toBe("ref-1")
  })
})
