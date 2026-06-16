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

// Flag ON for this file — exercises the Phase 3 casting matcher surface.
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => flag === "featureCastingMatcherSurface",
  getFeatureFlags: () => ({
    featurePublishing: false,
    featureSurfaceResolver: true,
    featureShootSurface: false,
    featureReviewSurface: false,
    featureTalentRosterIA: false,
    featureTalentDetailIA: false,
    featureShotFilterTalentScope: false,
    featureTalentAgencyCombobox: false,
    featureCastingMatcherSurface: true,
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
    gender: "women",
    notes: "",
    measurements: { height: 68, waist: 26 },
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

describe("LibraryTalentPage — casting matcher surface (flag on)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows the roster (not the matcher surface) by default", () => {
    seed([talent("t1", "Sara Martinez"), talent("t2", "Bob Brown")])
    renderPage()
    expect(screen.getByText("Sara Martinez")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Casting Brief" })).toBeNull()
    expect(screen.getByRole("button", { name: "Open casting brief" })).toBeInTheDocument()
  })

  it("swaps the roster for a dedicated ranked surface when casting is opened", () => {
    seed([talent("t1", "Sara Martinez"), talent("t2", "Bob Brown")])
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Open casting brief" }))
    // The matcher is now the surface: its brief + ranked results are shown…
    expect(screen.getByRole("heading", { name: "Casting Brief" })).toBeInTheDocument()
    expect(screen.getByText("Requirements")).toBeInTheDocument()
    // …and the roster grid is gone (no in-place re-sort to bleed into).
    expect(screen.queryByText("Sara Martinez")).toBeNull()
  })

  it("returns to the roster when the surface is closed", () => {
    seed([talent("t1", "Sara Martinez"), talent("t2", "Bob Brown")])
    renderPage()
    fireEvent.click(screen.getByRole("button", { name: "Open casting brief" }))
    expect(screen.getByRole("heading", { name: "Casting Brief" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close casting brief" }))
    expect(screen.queryByRole("heading", { name: "Casting Brief" })).toBeNull()
    expect(screen.getByText("Sara Martinez")).toBeInTheDocument()
  })
})
