/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/features/shots/components/ProductAssignmentPicker", () => ({
  ProductAssignmentPicker: () => <div>Product picker</div>,
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => null,
}))

vi.mock("@/shared/lib/uploadImage", () => ({
  uploadShotReferenceImage: vi.fn(),
}))

import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"

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

describe("ShotLooksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders hero product select without throwing", () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [{ familyId: "fam-1", familyName: "Classic Tee", sizeScope: "pending" }],
          heroProductId: null,
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)

    expect(screen.getByText("Cover product (optional)")).toBeInTheDocument()
    expect(screen.getByText("None")).toBeInTheDocument()
  })
})
