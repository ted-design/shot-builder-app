/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot, ShotVersion } from "@/shared/types"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: "producer",
    user: {
      uid: "u1",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      photoURL: null,
    },
  }),
}))

vi.mock("@/features/shots/hooks/useShotVersions", () => ({
  useShotVersions: vi.fn(),
}))

vi.mock("@/features/shots/lib/shotVersioning", () => ({
  restoreShotVersion: vi.fn(),
}))

import { useShotVersions } from "@/features/shots/hooks/useShotVersions"
import { restoreShotVersion } from "@/features/shots/lib/shotVersioning"
import { ShotVersionHistorySection } from "@/features/shots/components/ShotVersionHistorySection"

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
    description: overrides.description,
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

function makeVersion(overrides: Partial<ShotVersion>): ShotVersion {
  return {
    id: overrides.id ?? "v1",
    snapshot: overrides.snapshot ?? { title: "Old title" },
    createdAt: overrides.createdAt ?? Timestamp.fromMillis(Date.now()),
    createdBy: overrides.createdBy ?? "u1",
    createdByName: overrides.createdByName ?? "Alex Rivera",
    createdByAvatar: overrides.createdByAvatar ?? null,
    changeType: overrides.changeType ?? "update",
    changedFields: overrides.changedFields ?? ["title"],
  }
}

describe("ShotVersionHistorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows empty state when no versions exist", () => {
    ;(useShotVersions as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotVersionHistorySection shot={makeShot({})} />)
    fireEvent.click(screen.getByRole("button", { name: /history/i }))

    expect(screen.getByText("No history yet.")).toBeInTheDocument()
  })

  it("restores a selected version after confirmation", async () => {
    ;(useShotVersions as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeVersion({ id: "v-1" })],
      loading: false,
      error: null,
    })
    ;(restoreShotVersion as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(undefined)

    const shot = makeShot({})
    render(<ShotVersionHistorySection shot={shot} />)

    fireEvent.click(screen.getByRole("button", { name: /history/i }))
    fireEvent.click(screen.getByRole("button", { name: "Restore" }))

    const dialog = await screen.findByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Restore" }))

    expect(restoreShotVersion).toHaveBeenCalledWith({
      clientId: "c1",
      shotId: "s1",
      version: expect.objectContaining({ id: "v-1" }),
      currentShot: shot,
      user: expect.objectContaining({ uid: "u1" }),
    })
  })
})

