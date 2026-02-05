/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: vi.fn(),
  useLocations: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1" }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/shots/components/ShotStatusSelect", () => ({
  ShotStatusSelect: ({ currentStatus }: { readonly currentStatus: string }) => (
    <span>status:{currentStatus}</span>
  ),
}))

vi.mock("@/features/shots/components/CreateShotDialog", () => ({
  CreateShotDialog: () => null,
}))

vi.mock("@/features/pulls/components/CreatePullFromShotsDialog", () => ({
  CreatePullFromShotsDialog: () => null,
}))

import { useShots } from "@/features/shots/hooks/useShots"
import { useLocations, useTalent } from "@/features/shots/hooks/usePickerData"
import ShotListPage from "@/features/shots/components/ShotListPage"

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
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects/:id/shots" element={<ShotListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ShotListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
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
  })

  it("renders table view when view=table", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("renders visual view when view=visual", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha", status: "todo" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=visual")

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
    // Visual cards render StatusBadge (Draft) instead of ShotStatusSelect mock (status:todo).
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.queryByText("status:todo")).not.toBeInTheDocument()
  })

  it("renders gallery thumbnails with object-cover (no letterboxing)", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          heroImage: {
            path: "clients/c1/shots/a/hero.webp",
            downloadURL: "https://example.com/alpha.webp",
          },
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    const img = screen.getByAltText("Alpha")
    expect(img).toHaveClass("object-cover")
    expect(img).not.toHaveClass("object-contain")
  })

  it("renders visual thumbnails with object-cover (no letterboxing)", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          heroImage: {
            path: "clients/c1/shots/a/hero.webp",
            downloadURL: "https://example.com/alpha.webp",
          },
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=visual")

    const img = screen.getByAltText("Alpha")
    expect(img).toHaveClass("object-cover")
    expect(img).not.toHaveClass("object-contain")
  })

  it("shows attached products, talent, and location in table rows", () => {
    ;(useTalent as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        { id: "t1", name: "Jane" },
        { id: "t2", name: "Bob" },
      ],
      loading: false,
      error: null,
    })
    ;(useLocations as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [{ id: "loc1", name: "Studio A" }],
      loading: false,
      error: null,
    })
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          locationId: "loc1",
          products: [
            {
              familyId: "f1",
              familyName: "Jacket",
              colourName: "Black",
              sizeScope: "single",
              size: "M",
            },
          ],
          talent: ["t1", "t2"],
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.getByText("Studio A")).toBeInTheDocument()
    expect(screen.getByText("Jacket (Black • M)")).toBeInTheDocument()
    expect(screen.getByText("Jane")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })

  it("switches between table and gallery views", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.getByRole("table")).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText("Gallery view"))

    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByText("Alpha")).toBeInTheDocument()
  })

  it("filters by query param q", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({ id: "a", title: "Alpha" }),
        makeShot({ id: "b", title: "Bravo" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name&q=alp")

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument()
  })

  it("filters by multiple statuses via status=csv", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({ id: "a", title: "Alpha", status: "todo" }),
        makeShot({ id: "b", title: "Bravo", status: "complete" }),
        makeShot({ id: "c", title: "Charlie", status: "on_hold" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name&status=todo,complete")

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.getByText("Bravo")).toBeInTheDocument()
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument()
  })

  it("shows a grouped layout when group=date", () => {
    const withDate = makeShot({
      id: "a",
      title: "Alpha",
      date: Timestamp.fromDate(new Date("2026-02-05T00:00:00Z")),
    })
    const noDate = makeShot({ id: "b", title: "Bravo", date: undefined })

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [withDate, noDate],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?group=date")

    expect(screen.getByText("2026-02-05")).toBeInTheDocument()
    expect(screen.getByText("No date")).toBeInTheDocument()
  })

  it("shows a no-matching empty state when filters eliminate all shots", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha", status: "todo" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?status=complete")

    expect(screen.getByText("No matching shots")).toBeInTheDocument()
  })

  it("treats heroImage.path as present for missing=image filtering", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "with-path",
          title: "Has Path",
          heroImage: { path: "shots/s1/hero.webp", downloadURL: "" },
        }),
        makeShot({ id: "missing", title: "Missing Image", heroImage: undefined }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?missing=image")

    expect(screen.getByText("Missing Image")).toBeInTheDocument()
    expect(screen.queryByText("Has Path")).not.toBeInTheDocument()
  })

  it("shows a reorder-disabled banner when search is active", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({ id: "a", title: "Alpha" }),
        makeShot({ id: "b", title: "Bravo" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?q=alp")

    expect(screen.getByText(/Reordering is disabled while/i)).toBeInTheDocument()
  })

  it("respects persisted field visibility (description hidden)", () => {
    window.localStorage.setItem(
      "sb:shots:list:c1:p1:fields:v1",
      JSON.stringify({ description: false }),
    )

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha", description: "Should be hidden" })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByText("Should be hidden")).not.toBeInTheDocument()
  })
})
