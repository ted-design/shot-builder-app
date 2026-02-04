/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", role: "producer" }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project One" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
}))

vi.mock("@/features/shots/lib/tagManagementWrites", () => ({
  renameTagAcrossShots: vi.fn(),
  recolorTagAcrossShots: vi.fn(),
  deleteTagAcrossShots: vi.fn(),
  mergeTagsAcrossShots: vi.fn(),
}))

import { useShots } from "@/features/shots/hooks/useShots"
import { renameTagAcrossShots } from "@/features/shots/lib/tagManagementWrites"
import TagManagementPage from "@/features/shots/components/TagManagementPage"

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
    deleted: overrides.deleted ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TagManagementPage />
    </MemoryRouter>,
  )
}

describe("TagManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renames a tag across shots from the Details panel", async () => {
    const shots = [
      makeShot({
        id: "s1",
        tags: [{ id: "tag-1", label: "Outdoor", color: "blue" }],
      }),
    ]

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: shots,
      loading: false,
      error: null,
    })

    ;(renameTagAcrossShots as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      1,
    )

    renderPage()

    fireEvent.click(screen.getAllByText("Outdoor")[0]!)

    const nameField = within(screen.getByTestId("tag-details-name")).getByText("Outdoor")
    fireEvent.click(nameField)

    const input = screen.getByDisplayValue("Outdoor")
    fireEvent.change(input, { target: { value: "Outdoor 2" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(renameTagAcrossShots).toHaveBeenCalledTimes(1)
    })

    expect(renameTagAcrossShots).toHaveBeenCalledWith({
      clientId: "c1",
      shots,
      tagId: "tag-1",
      nextLabel: "Outdoor 2",
    })
  })
})
