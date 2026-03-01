/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TalentShotHistory } from "@/features/library/components/TalentShotHistory"

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
  useIsTablet: () => false,
  useMediaQuery: () => true,
}))

const mockUseTalentShotHistory = vi.fn()

vi.mock("@/features/library/hooks/useTalentShotHistory", () => ({
  useTalentShotHistory: (...args: unknown[]) => mockUseTalentShotHistory(...args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: "producer",
    user: { uid: "u1" },
  }),
}))

describe("TalentShotHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows empty state when no shot history", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    })

    render(<TalentShotHistory talentId="t1" clientId="c1" />)
    expect(screen.getByText("No shot history")).toBeInTheDocument()
    expect(
      screen.getByText(/this talent hasn.t been assigned to any shots yet/i),
    ).toBeInTheDocument()
  })

  it("shows loading state", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [],
      loading: true,
      error: null,
    })

    render(<TalentShotHistory talentId="t1" clientId="c1" />)
    // Loading state should be present (no empty state or shots)
    expect(screen.queryByText("No shot history")).not.toBeInTheDocument()
  })

  it("groups shots by project", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [
        {
          shotId: "s1",
          projectId: "p1",
          projectName: "Spring Campaign",
          shotTitle: "Hero look",
          shotNumber: "042",
          shotStatus: "complete",
          heroImageUrl: null,
          shootDate: "2026-02-15",
          updatedAt: new Date(),
        },
        {
          shotId: "s2",
          projectId: "p1",
          projectName: "Spring Campaign",
          shotTitle: "Detail shot",
          shotNumber: "043",
          shotStatus: "complete",
          heroImageUrl: null,
          shootDate: "2026-02-15",
          updatedAt: new Date(),
        },
        {
          shotId: "s3",
          projectId: "p2",
          projectName: "Holiday Lookbook",
          shotTitle: "Knitwear edit",
          shotNumber: "018",
          shotStatus: "todo",
          heroImageUrl: null,
          shootDate: "2025-11-03",
          updatedAt: new Date(),
        },
      ],
      loading: false,
      error: null,
    })

    render(<TalentShotHistory talentId="t1" clientId="c1" />)

    // Project group headers
    expect(screen.getByText("Spring Campaign")).toBeInTheDocument()
    expect(screen.getByText("Holiday Lookbook")).toBeInTheDocument()

    // Shot titles
    expect(screen.getByText("Hero look")).toBeInTheDocument()
    expect(screen.getByText("Detail shot")).toBeInTheDocument()
    expect(screen.getByText("Knitwear edit")).toBeInTheDocument()

    // Shot numbers
    expect(screen.getByText("#042")).toBeInTheDocument()
    expect(screen.getByText("#043")).toBeInTheDocument()
    expect(screen.getByText("#018")).toBeInTheDocument()

    // Status badges (using status mappings)
    const shotBadges = screen.getAllByText("Shot")
    expect(shotBadges.length).toBe(2)
    expect(screen.getByText("Draft")).toBeInTheDocument()

    // Summary
    expect(screen.getByText("3 shots across 2 projects")).toBeInTheDocument()
  })

  it("shows error state", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [],
      loading: false,
      error: new Error("Network error"),
    })

    render(<TalentShotHistory talentId="t1" clientId="c1" />)
    expect(screen.getByText("Network error")).toBeInTheDocument()
  })

  it("passes talentId and clientId to hook", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    })

    render(<TalentShotHistory talentId="t99" clientId="c42" />)
    expect(mockUseTalentShotHistory).toHaveBeenCalledWith("t99", "c42")
  })

  it("renders date formatted", () => {
    mockUseTalentShotHistory.mockReturnValue({
      entries: [
        {
          shotId: "s1",
          projectId: "p1",
          projectName: "Campaign",
          shotTitle: "Shot A",
          shotNumber: "001",
          shotStatus: "in_progress",
          heroImageUrl: null,
          shootDate: "2026-02-15",
          updatedAt: new Date(),
        },
      ],
      loading: false,
      error: null,
    })

    render(<TalentShotHistory talentId="t1" clientId="c1" />)
    expect(screen.getByText("Feb 15, 2026")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
  })
})
