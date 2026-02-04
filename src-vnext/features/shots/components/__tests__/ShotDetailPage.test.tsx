/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/features/shots/hooks/useShot", () => ({
  useShot: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => true,
}))

vi.mock("@/features/shots/components/ShotStatusSelect", () => ({
  ShotStatusSelect: () => <div>Status</div>,
}))

vi.mock("@/features/shots/components/TalentPicker", () => ({
  TalentPicker: () => <div>Talent</div>,
}))

vi.mock("@/features/shots/components/LocationPicker", () => ({
  LocationPicker: () => <div>Location</div>,
}))

vi.mock("@/features/shots/components/NotesSection", () => ({
  NotesSection: () => <div>Notes</div>,
}))

vi.mock("@/features/shots/components/HeroImageSection", () => ({
  HeroImageSection: () => <div>Hero</div>,
}))

vi.mock("@/features/shots/components/ShotLooksSection", () => ({
  ShotLooksSection: () => <div>Looks</div>,
}))

vi.mock("@/features/shots/components/ShotCommentsSection", () => ({
  ShotCommentsSection: () => <div>Comments</div>,
}))

vi.mock("@/features/shots/components/ProductAssignmentPicker", () => ({
  ProductAssignmentPicker: () => <div data-testid="shot-products-picker">ProductsPicker</div>,
}))

import { useShot } from "@/features/shots/hooks/useShot"
import ShotDetailPage from "@/features/shots/components/ShotDetailPage"

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

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/shots/s1"]}>
      <Routes>
        <Route path="/projects/:id/shots/:sid" element={<ShotDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShotDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("strips HTML tags from the description display", () => {
    ;(useShot as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: makeShot({ description: "<p>Hello&nbsp;World</p>" }),
      loading: false,
      error: null,
    })

    renderPage()

    expect(screen.getByText("Hello World")).toBeInTheDocument()
    expect(screen.queryByText("<p>Hello&nbsp;World</p>")).not.toBeInTheDocument()
  })

  it("does not render a duplicate shot-level products picker", () => {
    ;(useShot as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: makeShot({ products: [{ familyId: "fam-1", familyName: "Classic Tee", sizeScope: "pending" }] }),
      loading: false,
      error: null,
    })

    renderPage()

    expect(screen.queryByTestId("shot-products-picker")).not.toBeInTheDocument()
  })
})
