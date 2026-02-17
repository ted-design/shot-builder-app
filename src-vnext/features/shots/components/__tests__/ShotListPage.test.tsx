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

  it("renders gallery thumbnails with bounded native aspect ratio", () => {
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
    expect(img).toHaveClass("object-contain")
    expect(img).toHaveClass("max-h-[150px]")
    expect(img).toHaveClass("max-w-[150px]")
    expect(img).not.toHaveClass("object-cover")
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

  it("does not render a hero placeholder when no hero image exists", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeShot({ id: "a", title: "Alpha", heroImage: undefined })],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    expect(screen.queryByAltText("Alpha")).not.toBeInTheDocument()
  })

  it("groups tags into categorized columns in gallery cards", () => {
    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          tags: [
            { id: "g1", label: "Women", color: "#22c55e", category: "gender" },
            { id: "p1", label: "High Priority", color: "#ef4444", category: "priority" },
            { id: "m1", label: "Video", color: "#3b82f6", category: "media" },
          ],
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    expect(screen.getByText("Gender")).toBeInTheDocument()
    expect(screen.getByText("Priority Tag")).toBeInTheDocument()
    expect(screen.getByText("Media")).toBeInTheDocument()
    expect(screen.getByText("Women")).toBeInTheDocument()
    expect(screen.getByText("High Priority")).toBeInTheDocument()
    expect(screen.getByText("Video")).toBeInTheDocument()
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

  it("renders notes in table view when notes column is enabled", () => {
    window.localStorage.setItem(
      "sb:shots:list:c1:p1:fields:v1",
      JSON.stringify({ notes: true }),
    )

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          notes: "<p>Legacy HTML note</p>",
          notesAddendum: "Bring handheld steamer",
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=table&sort=name")

    expect(screen.getByText("Notes")).toBeInTheDocument()
    expect(screen.getByText("Bring handheld steamer")).toBeInTheDocument()
    expect(screen.queryByText("Legacy HTML note")).not.toBeInTheDocument()
  })

  it("renders notes in gallery view when notes preview is enabled", () => {
    window.localStorage.setItem(
      "sb:shots:list:c1:p1:fields:v1",
      JSON.stringify({ notes: true }),
    )

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          notesAddendum: "Fog machine at 30%",
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    expect(screen.getByText("Fog machine at 30%")).toBeInTheDocument()
  })

  it("renders notes in visual view when notes preview is enabled", () => {
    window.localStorage.setItem(
      "sb:shots:list:c1:p1:fields:v1",
      JSON.stringify({ notes: true }),
    )

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          notes: "<p>Use 50mm lens, low angle.</p>",
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots?view=visual")

    expect(screen.getByText("Use 50mm lens, low angle.")).toBeInTheDocument()
  })

  it("renders note URLs as clickable links", () => {
    window.localStorage.setItem(
      "sb:shots:list:c1:p1:fields:v1",
      JSON.stringify({ notes: true }),
    )

    ;(useShots as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeShot({
          id: "a",
          title: "Alpha",
          notesAddendum: "Reference: https://example.com/lookbook",
        }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects/p1/shots")

    const link = screen.getByRole("link", { name: "https://example.com/lookbook" })
    expect(link).toHaveAttribute("href", "https://example.com/lookbook")
    expect(link).toHaveAttribute("target", "_blank")
  })
})
