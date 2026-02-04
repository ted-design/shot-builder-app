/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

vi.mock("@/features/shots/hooks/useShots", () => ({
  useShots: vi.fn(),
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
