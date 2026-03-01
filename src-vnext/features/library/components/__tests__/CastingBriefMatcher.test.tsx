/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CastingBriefMatcher } from "@/features/library/components/CastingBriefMatcher"
import type { TalentRecord } from "@/shared/types"

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
  useIsTablet: () => false,
  useMediaQuery: () => true,
}))

const TALENT: readonly TalentRecord[] = [
  {
    id: "t1",
    name: "Sara Martinez",
    agency: "Wilhelmina",
    gender: "female",
    measurements: { height: 69, waist: 24, hips: 34 },
  },
  {
    id: "t2",
    name: "Sarah Johnson",
    agency: "IMG Models",
    gender: "female",
    measurements: { height: 68, waist: 25, hips: 35 },
  },
  {
    id: "t3",
    name: "Alex Rivera",
    agency: "Elite",
    gender: "male",
    measurements: { height: 72, waist: 32 },
  },
]

describe("CastingBriefMatcher", () => {
  it("renders the brief form heading", () => {
    render(<CastingBriefMatcher talent={TALENT} />)
    expect(screen.getByText("Casting Brief")).toBeInTheDocument()
    expect(screen.getByText("Requirements")).toBeInTheDocument()
  })

  it("shows empty state when no requirements set", () => {
    render(<CastingBriefMatcher talent={TALENT} />)
    expect(
      screen.getByText(/set gender and at least one measurement range/i),
    ).toBeInTheDocument()
  })

  it("renders gender select", () => {
    render(<CastingBriefMatcher talent={TALENT} />)
    expect(screen.getByText("Women")).toBeInTheDocument()
  })

  it("renders measurement range inputs for women by default", () => {
    render(<CastingBriefMatcher talent={TALENT} />)
    expect(screen.getByText("Height")).toBeInTheDocument()
    expect(screen.getByText("Waist")).toBeInTheDocument()
    expect(screen.getByText("Hips")).toBeInTheDocument()
  })

  it("shows results when a measurement range is filled in", () => {
    render(<CastingBriefMatcher talent={TALENT} />)

    const heightMin = screen.getByLabelText("Height min")
    fireEvent.change(heightMin, { target: { value: "67" } })

    // Now there should be results or "match results" header
    expect(screen.getByText("Match Results")).toBeInTheDocument()
  })

  it("has a clear button", () => {
    render(<CastingBriefMatcher talent={TALENT} />)
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument()
  })

  it("shows matched talent count", () => {
    render(<CastingBriefMatcher talent={TALENT} />)

    const heightMin = screen.getByLabelText("Height min")
    fireEvent.change(heightMin, { target: { value: "60" } })

    expect(screen.getByText(/talent matched/)).toBeInTheDocument()
  })
})
