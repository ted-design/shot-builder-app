/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { BulkAddToProjectDialog } from "./BulkAddToProjectDialog"
import type { SelectedFamily, SelectedSku } from "@/features/products/hooks/useProductSelection"

// --- Mocks ---

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

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Spring 2026", status: "active", clientId: "c1" },
      { id: "p2", name: "Summer 2026", status: "active", clientId: "c1" },
      { id: "p3", name: "Archived Project", status: "completed", clientId: "c1" },
    ],
    loading: false,
    error: null,
  }),
}))

const mockBulkCreate = vi.fn()
vi.mock("@/features/shots/lib/bulkShotWrites", () => ({
  bulkCreateShotsFromProducts: (...args: unknown[]) => mockBulkCreate(...args),
}))

vi.mock("@/shared/hooks/use-toast", () => ({
  toast: vi.fn(),
}))

const FAMILIES: SelectedFamily[] = [
  { familyId: "fam1", familyName: "Classic Tee" },
  { familyId: "fam2", familyName: "Slim Polo" },
]

const SKUS: SelectedSku[] = [
  { familyId: "fam1", familyName: "Classic Tee", skuId: "sku1", skuName: "Black" },
  { familyId: "fam1", familyName: "Classic Tee", skuId: "sku2", skuName: "White" },
]

function renderDialog(
  families: SelectedFamily[] = FAMILIES,
  skus: SelectedSku[] = [],
  onClose = vi.fn(),
  onSuccess = vi.fn(),
) {
  return render(
    <MemoryRouter>
      <BulkAddToProjectDialog
        selectedFamilies={families}
        selectedSkus={skus}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </MemoryRouter>,
  )
}

describe("BulkAddToProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBulkCreate.mockResolvedValue({ created: 2 })
  })

  it("renders the dialog title", () => {
    renderDialog()
    expect(screen.getByText("Add to Project")).toBeInTheDocument()
  })

  it("shows only active projects in the project picker", () => {
    renderDialog()
    const trigger = screen.getByTestId("bulk-dialog-project-select")
    fireEvent.click(trigger)
    expect(screen.getByText("Spring 2026")).toBeInTheDocument()
    expect(screen.getByText("Summer 2026")).toBeInTheDocument()
    expect(screen.queryByText("Archived Project")).not.toBeInTheDocument()
  })

  it("confirm button is disabled until project is selected", () => {
    renderDialog()
    const btn = screen.getByTestId("bulk-dialog-confirm")
    expect(btn).toBeDisabled()
  })

  it("shows preview list with family names", () => {
    renderDialog()
    expect(screen.getByText("Classic Tee")).toBeInTheDocument()
    expect(screen.getByText("Slim Polo")).toBeInTheDocument()
  })

  it("shows '2 shots will be created' for 2 families", () => {
    renderDialog()
    expect(screen.getByText("2 shots will be created")).toBeInTheDocument()
  })

  it("shows '1 shot will be created' for single family", () => {
    renderDialog([{ familyId: "fam1", familyName: "Classic Tee" }])
    expect(screen.getByText("1 shot will be created")).toBeInTheDocument()
  })

  it("does NOT show granularity toggle when only families are selected", () => {
    renderDialog(FAMILIES, [])
    expect(screen.queryByTestId("bulk-dialog-granularity-family")).not.toBeInTheDocument()
  })

  it("shows granularity toggle when both families and SKUs are selected", () => {
    renderDialog(FAMILIES, SKUS)
    expect(screen.getByTestId("bulk-dialog-granularity-family")).toBeInTheDocument()
    expect(screen.getByTestId("bulk-dialog-granularity-sku")).toBeInTheDocument()
  })

  it("switching to SKU granularity updates shot count to SKU count", () => {
    renderDialog(FAMILIES, SKUS)
    // Default should be SKU since skus.length > 0
    expect(screen.getByText("2 shots will be created")).toBeInTheDocument()
    // Switch to family granularity
    fireEvent.click(screen.getByTestId("bulk-dialog-granularity-family"))
    expect(screen.getByText("2 shots will be created")).toBeInTheDocument()
  })

  it("calls onClose when Cancel is clicked", () => {
    const onClose = vi.fn()
    renderDialog(FAMILIES, [], onClose)
    fireEvent.click(screen.getByText("Cancel"))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("calls bulkCreateShotsFromProducts with correct args on confirm", async () => {
    renderDialog()
    // Select a project
    const trigger = screen.getByTestId("bulk-dialog-project-select")
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText("Spring 2026"))

    const btn = screen.getByTestId("bulk-dialog-confirm")
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)

    await waitFor(() => {
      expect(mockBulkCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "c1",
          projectId: "p1",
          createdBy: "u1",
          items: expect.arrayContaining([
            expect.objectContaining({ familyId: "fam1" }),
            expect.objectContaining({ familyId: "fam2" }),
          ]),
        }),
      )
    })
  })

  it("calls onSuccess after successful creation", async () => {
    const onSuccess = vi.fn()
    renderDialog(FAMILIES, [], vi.fn(), onSuccess)

    const trigger = screen.getByTestId("bulk-dialog-project-select")
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText("Spring 2026"))
    fireEvent.click(screen.getByTestId("bulk-dialog-confirm"))

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1)
    })
  })

  it("shows loading state during write", async () => {
    let resolveCreate!: (val: unknown) => void
    mockBulkCreate.mockReturnValue(new Promise((r) => (resolveCreate = r)))

    renderDialog()
    const trigger = screen.getByTestId("bulk-dialog-project-select")
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText("Spring 2026"))
    fireEvent.click(screen.getByTestId("bulk-dialog-confirm"))

    expect(screen.getByTestId("bulk-dialog-confirm")).toHaveTextContent("Creating…")

    resolveCreate({ created: 2 })
  })
})
