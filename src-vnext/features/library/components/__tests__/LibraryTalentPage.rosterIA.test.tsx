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

// Flag ON for this file — exercises the Phase 1a roster IA surface.
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => flag === "featureTalentRosterIA",
  getFeatureFlags: () => ({
    featurePublishing: false,
    featureSurfaceResolver: true,
    featureShootSurface: false,
    featureReviewSurface: false,
    featureTalentRosterIA: true,
  }),
}))

import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import LibraryTalentPage from "@/features/library/components/LibraryTalentPage"

function talent(id: string, name: string) {
  return {
    id,
    name,
    agency: "IMG",
    email: null,
    phone: null,
    url: null,
    gender: null,
    notes: "",
    measurements: null,
    headshotPath: null,
    headshotUrl: null,
    galleryImages: [],
    castingSessions: [],
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

describe("LibraryTalentPage — roster IA (flag on)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("surfaces the Height and Waist toolbar controls", () => {
    seed([talent("t1", "Alice Adams"), talent("t2", "Bob Brown")])
    renderPage()
    expect(screen.getByRole("button", { name: "Height range filter" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Waist range filter" })).toBeInTheDocument()
  })

  it("shows the total count when nothing is filtered", () => {
    seed([talent("t1", "Alice Adams"), talent("t2", "Bob Brown")])
    renderPage()
    expect(screen.getByTestId("talent-result-count")).toHaveTextContent("2 talent")
  })

  it("updates the result count as the search narrows results", () => {
    seed([talent("t1", "Alice Adams"), talent("t2", "Bob Brown")])
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/Search talent/i), {
      target: { value: "Alice" },
    })
    expect(screen.getByTestId("talent-result-count")).toHaveTextContent("Showing 1 of 2 talent")
  })
})
