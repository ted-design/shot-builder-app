/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ShootReadinessWidget } from "./ShootReadinessWidget"
import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"
import { Timestamp } from "firebase/firestore"

const DAY_MS = 24 * 60 * 60 * 1000

function ts(offsetMs: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + offsetMs))
}

let mockItems: ShootReadinessItem[] = []
let mockLoading = false

vi.mock("@/features/products/hooks/useShootReadiness", () => ({
  useShootReadiness: () => ({ items: mockItems, loading: mockLoading }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: "producer",
    clientId: "c1",
    user: { uid: "u1", email: "u1@test.com", displayName: "Test User", photoURL: null },
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
}))

vi.mock("@/features/dashboard/hooks/useProductProjectMap", () => ({
  useProductProjectMap: () => ({
    familyProjectMap: new Map(),
    skuProjectMap: new Map(),
    projectNames: new Map(),
  }),
}))

vi.mock("@/features/products/components/BulkAddToProjectDialog", () => ({
  BulkAddToProjectDialog: () => null,
}))

// Clear the filter persistence so the default (true) applies. Tests that need
// items visible should set skusWithFlags > 0 on their mock items.
beforeEach(() => {
  try {
    globalThis.localStorage?.removeItem("sb:readiness-requirements-filter")
  } catch {
    // Ignore
  }
})

function renderWidget() {
  return render(
    <MemoryRouter>
      <ShootReadinessWidget />
    </MemoryRouter>,
  )
}

describe("ShootReadinessWidget", () => {
  describe("loading state", () => {
    it("renders skeleton placeholders when loading", () => {
      mockLoading = true
      mockItems = []
      renderWidget()
      expect(screen.getByText("Shoot Readiness")).toBeInTheDocument()
      mockLoading = false
    })
  })

  describe("empty state", () => {
    it("shows empty message when no items", () => {
      mockItems = []
      mockLoading = false
      renderWidget()
      expect(
        screen.getByText("No products with upcoming launches, tracked samples, or shoot requirements."),
      ).toBeInTheDocument()
    })
  })

  describe("samples_only tier", () => {
    it("shows 'Samples ready' message for samples_only tier", () => {
      mockItems = [
        {
          familyId: "f1",
          familyName: "Summer Tee",
          launchDate: null,
          totalSkus: 2,
          skusWithFlags: 1,
          samplesArrived: 3,
          samplesTotal: 3,
          readinessPct: 100,
          shootWindow: {
            suggestedStart: null,
            suggestedEnd: null,
            confidence: "low",
            constraints: [],
            tier: "samples_only",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("Summer Tee")).toBeInTheDocument()
      expect(screen.getByText(/Samples ready/)).toBeInTheDocument()
      expect(screen.getByText(/available to schedule/)).toBeInTheDocument()
    })

    it("shows sample count for samples_only tier with multiple samples", () => {
      mockItems = [
        {
          familyId: "f2",
          familyName: "Winter Jacket",
          launchDate: null,
          totalSkus: 1,
          skusWithFlags: 1,
          samplesArrived: 2,
          samplesTotal: 5,
          readinessPct: 40,
          shootWindow: {
            suggestedStart: null,
            suggestedEnd: null,
            confidence: "low",
            constraints: [],
            tier: "samples_only",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("2 samples arrived")).toBeInTheDocument()
    })

    it("shows singular 'sample' for exactly 1 arrived", () => {
      mockItems = [
        {
          familyId: "f3",
          familyName: "Boot",
          launchDate: null,
          totalSkus: 1,
          skusWithFlags: 1,
          samplesArrived: 1,
          samplesTotal: 3,
          readinessPct: 33,
          shootWindow: {
            suggestedStart: null,
            suggestedEnd: null,
            confidence: "low",
            constraints: [],
            tier: "samples_only",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("1 sample arrived")).toBeInTheDocument()
    })
  })

  describe("full tier", () => {
    it("shows shoot window dates and urgency badge for full tier", () => {
      const startDate = new Date(Date.now() + 5 * DAY_MS)
      const endDate = new Date(Date.now() + 30 * DAY_MS)
      mockItems = [
        {
          familyId: "f4",
          familyName: "Spring Dress",
          launchDate: ts(45 * DAY_MS),
          totalSkus: 3,
          skusWithFlags: 2,
          samplesArrived: 3,
          samplesTotal: 3,
          readinessPct: 100,
          shootWindow: {
            suggestedStart: startDate,
            suggestedEnd: endDate,
            confidence: "high",
            constraints: ["All samples arrived"],
            tier: "full",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("Spring Dress")).toBeInTheDocument()
      expect(screen.getByText(/Shoot window:/)).toBeInTheDocument()
      expect(screen.getByTestId("urgency-badge")).toBeInTheDocument()
    })

    it("shows colorway count and sample counts for full tier", () => {
      mockItems = [
        {
          familyId: "f5",
          familyName: "Sneaker Pro",
          launchDate: ts(20 * DAY_MS),
          totalSkus: 4,
          skusWithFlags: 1,
          samplesArrived: 2,
          samplesTotal: 6,
          readinessPct: 33,
          shootWindow: {
            suggestedStart: new Date(),
            suggestedEnd: new Date(Date.now() + 6 * DAY_MS),
            confidence: "medium",
            constraints: [],
            tier: "full",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("4 colorways")).toBeInTheDocument()
      expect(screen.getByText(/2\/6 samples arrived/)).toBeInTheDocument()
      expect(screen.getByTestId("urgency-badge")).toBeInTheDocument()
    })

    it("shows urgency badge instead of confidence badge for overdue items", () => {
      mockItems = [
        {
          familyId: "f6",
          familyName: "Overdue Item",
          launchDate: ts(-5 * DAY_MS),
          totalSkus: 1,
          skusWithFlags: 1,
          samplesArrived: 0,
          samplesTotal: 2,
          readinessPct: 0,
          shootWindow: {
            suggestedStart: new Date(),
            suggestedEnd: new Date(Date.now() - 5 * DAY_MS),
            confidence: "low",
            constraints: ["Deadline has passed"],
            tier: "full",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByTestId("urgency-badge")).toBeInTheDocument()
      expect(screen.queryByText("Low")).not.toBeInTheDocument()
    })
  })

  describe("filters", () => {
    it("shows filter toolbar when items exist", () => {
      mockItems = [
        {
          familyId: "f7",
          familyName: "Any Product",
          launchDate: ts(10 * DAY_MS),
          totalSkus: 1,
          skusWithFlags: 1,
          samplesArrived: 0,
          samplesTotal: 0,
          readinessPct: 0,
          shootWindow: {
            suggestedStart: new Date(),
            suggestedEnd: new Date(Date.now() + 10 * DAY_MS),
            confidence: "medium",
            constraints: [],
            tier: "full",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByPlaceholderText("Search products...")).toBeInTheDocument()
      expect(screen.getByText("Has shoot requirements")).toBeInTheDocument()
    })

    it("shows requirement count on cards when skusWithFlags > 0", () => {
      mockItems = [
        {
          familyId: "f8",
          familyName: "Product With Reqs",
          launchDate: ts(10 * DAY_MS),
          totalSkus: 5,
          skusWithFlags: 3,
          samplesArrived: 0,
          samplesTotal: 0,
          readinessPct: 0,
          shootWindow: {
            suggestedStart: new Date(),
            suggestedEnd: new Date(Date.now() + 10 * DAY_MS),
            confidence: "medium",
            constraints: [],
            tier: "full",
          },
        },
      ]
      mockLoading = false
      renderWidget()
      expect(screen.getByText("3 need shoot")).toBeInTheDocument()
    })
  })
})
