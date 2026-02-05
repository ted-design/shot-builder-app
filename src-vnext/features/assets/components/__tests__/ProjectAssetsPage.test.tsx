/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project One" }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", role: "producer" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: vi.fn(),
  useLocations: vi.fn(),
  useProductFamilies: vi.fn(),
}))

vi.mock("@/features/schedules/hooks/useCrew", () => ({
  useCrew: vi.fn(),
}))

vi.mock("@/features/assets/lib/projectAssetsWrites", () => ({
  addTalentToProject: vi.fn(),
  removeTalentFromProject: vi.fn(),
  createTalentAndAddToProject: vi.fn(),

  addLocationsToProject: vi.fn(),
  removeLocationFromProject: vi.fn(),
  createLocationAndAddToProject: vi.fn(),

  addCrewToProject: vi.fn(),
  removeCrewFromProject: vi.fn(),
  createCrewAndAddToProject: vi.fn(),
}))

import { useShots } from "@/features/shots/hooks/useShots"
import {
  useTalent,
  useLocations,
  useProductFamilies,
} from "@/features/shots/hooks/usePickerData"
import { useCrew } from "@/features/schedules/hooks/useCrew"
import {
  addTalentToProject,
  removeTalentFromProject,
  createTalentAndAddToProject,
} from "@/features/assets/lib/projectAssetsWrites"
import ProjectAssetsPage from "@/features/assets/components/ProjectAssetsPage"

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
      <ProjectAssetsPage />
    </MemoryRouter>,
  )
}

describe("ProjectAssetsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("adds existing talent to a project via the Add dialog", async () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ talentIds: ["t-in-project"] })],
      loading: false,
      error: null,
    })

    ;(useTalent as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        { id: "t-in-project", name: "Existing", agency: "A", projectIds: ["p1"] },
        { id: "t-add", name: "Add Me", agency: "B", projectIds: [] },
      ],
      loading: false,
      error: null,
    })

    ;(useLocations as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useProductFamilies as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useCrew as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(addTalentToProject as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      undefined,
    )

    renderPage()

    fireEvent.click(screen.getAllByRole("button", { name: /add/i })[0]!)

    fireEvent.click(screen.getByText("Add Me"))
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(addTalentToProject).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      ids: ["t-add"],
    })
  })

  it("confirms before removing talent that is referenced by shots", async () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ talentIds: ["t1"] })],
      loading: false,
      error: null,
    })

    ;(useTalent as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [{ id: "t1", name: "Used Talent", agency: "A", projectIds: ["p1"] }],
      loading: false,
      error: null,
    })

    ;(useLocations as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useProductFamilies as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useCrew as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(removeTalentFromProject as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      undefined,
    )

    renderPage()

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }))

    expect(removeTalentFromProject).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      id: "t1",
    })
  })

  it("creates new talent from the New dialog and assigns it to the project", async () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useTalent as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useLocations as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useProductFamilies as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(useCrew as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(createTalentAndAddToProject as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      undefined,
    )

    renderPage()

    fireEvent.click(screen.getAllByRole("button", { name: /new/i })[0]!)

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Person" } })
    fireEvent.change(screen.getByLabelText("Agency"), { target: { value: "CAA" } })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    expect(createTalentAndAddToProject).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      name: "New Person",
      agency: "CAA",
      notes: "",
    })
  })
})

