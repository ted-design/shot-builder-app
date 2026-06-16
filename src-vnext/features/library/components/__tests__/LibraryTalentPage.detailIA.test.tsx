/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", role: "producer", user: { uid: "u1" } }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/library/hooks/useTalentLibrary", () => ({
  useTalentLibrary: vi.fn(),
}))

vi.mock("@/shared/lib/resolveStoragePath", () => ({
  isUrl: (value: string) => value.startsWith("https://") || value.startsWith("http://"),
  resolveStoragePath: async (path: string) => path,
  getCachedUrl: (path: string) =>
    path.startsWith("https://") || path.startsWith("http://") ? path : undefined,
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/library/lib/talentWrites", () => ({
  createTalent: vi.fn(),
  updateTalent: vi.fn(),
  setTalentHeadshot: vi.fn(),
  removeTalentHeadshot: vi.fn(),
  uploadTalentPortfolioImages: vi.fn(),
  uploadTalentCastingImages: vi.fn(),
  deleteTalentImagePaths: vi.fn(),
}))

// Flag ON for this file — exercises the Phase 2 detail IA surface only
// (roster IA stays OFF so the roster renders unchanged).
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => flag === "featureTalentDetailIA",
  getFeatureFlags: () => ({
    featurePublishing: false,
    featureSurfaceResolver: true,
    featureShootSurface: false,
    featureReviewSurface: false,
    featureTalentRosterIA: false,
    featureTalentDetailIA: true,
  }),
}))

import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import LibraryTalentPage from "@/features/library/components/LibraryTalentPage"

function talent(id: string, name: string, projectIds: string[] = []) {
  return {
    id,
    name,
    agency: "IMG",
    email: "a@b.co",
    phone: "555-0100",
    url: null,
    gender: null,
    notes: "",
    measurements: null,
    headshotPath: null,
    headshotUrl: null,
    galleryImages: [],
    castingSessions: [],
    projectIds,
  }
}

function seed(rows: ReturnType<typeof talent>[]) {
  ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: rows,
    loading: false,
    error: null,
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LibraryTalentPage />
    </MemoryRouter>,
  )
}

describe("LibraryTalentPage — detail IA (flag on)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("demotes Contact to an inline meta-line and groups Fit signals / Creative assets", () => {
    seed([talent("t1", "Alice Adams")])
    renderPage()
    fireEvent.click(screen.getByText("Alice Adams"))

    // Contact is now an inline editorial meta-line, not a bordered "Contact" card.
    expect(screen.getByTestId("talent-contact-metaline")).toBeInTheDocument()
    expect(screen.queryByText("Contact")).toBeNull()

    // The two regrouped zones each carry a section eyebrow.
    expect(screen.getByText("Fit signals")).toBeInTheDocument()
    expect(screen.getByText("Creative assets")).toBeInTheDocument()
  })

  it("renders Projects as a read-only tag row (demoted from the bordered card)", () => {
    seed([talent("t1", "Alice Adams", ["p1"])])
    renderPage()
    fireEvent.click(screen.getByText("Alice Adams"))

    const tags = screen.getByTestId("talent-projects-tags")
    expect(tags).toBeInTheDocument()
    // The flag-off bordered card's empty-state copy is gone in the demoted row.
    expect(screen.queryByText("Not linked to any projects.")).toBeNull()
  })

  it("hides the project tag row when the talent has no projects", () => {
    seed([talent("t1", "Alice Adams")])
    renderPage()
    fireEvent.click(screen.getByText("Alice Adams"))

    expect(screen.queryByTestId("talent-projects-tags")).toBeNull()
  })
})
