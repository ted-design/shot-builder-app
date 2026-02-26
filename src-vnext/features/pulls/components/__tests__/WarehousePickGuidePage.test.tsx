import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"

// Mock Firestore
vi.mock("firebase/firestore", () => ({
  collectionGroup: vi.fn(),
  getDocs: vi.fn(),
  limit: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({
  db: {},
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => null,
}))

// Import after mocks
import { getDocs } from "firebase/firestore"

const mockPull = {
  id: "pull-1",
  projectId: "proj-1",
  clientId: "client-1",
  name: "Test Pull",
  shotIds: [],
  items: [
    {
      id: "item-1",
      familyId: "fam-1",
      familyName: "White Tee",
      colourName: "Ivory",
      styleNumber: "WH-001",
      sizes: [
        { size: "S", quantity: 2, fulfilled: 0 },
        { size: "M", quantity: 3, fulfilled: 0 },
      ],
      fulfillmentStatus: "pending" as const,
    },
    {
      id: "item-2",
      familyId: "fam-2",
      familyName: "Blue Jean",
      colourName: null,
      styleNumber: null,
      sizes: [{ size: "32", quantity: 1, fulfilled: 0 }],
      fulfillmentStatus: "pending" as const,
    },
  ],
  status: "published" as const,
  shareToken: "abc123",
  shareEnabled: true,
  shareAllowResponses: true,
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/pulls/shared/abc123/guide"]}>
      <Routes>
        <Route
          path="/pulls/shared/:shareToken/guide"
          element={<WarehousePickGuidePageLazy />}
        />
        <Route path="/pulls/shared/:shareToken" element={<div>Pull View</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

// Lazy import to allow mock setup
let WarehousePickGuidePageLazy: React.ComponentType

beforeEach(async () => {
  vi.clearAllMocks()

  const mockGetDocs = getDocs as unknown as ReturnType<typeof vi.fn>
  mockGetDocs.mockResolvedValue({
    empty: false,
    docs: [
      {
        id: mockPull.id,
        data: () => mockPull,
      },
    ],
  })

  const mod = await import("../WarehousePickGuidePage")
  WarehousePickGuidePageLazy = mod.default
})

describe("WarehousePickGuidePage", () => {
  it("renders landing screen with item count", async () => {
    renderPage()
    expect(await screen.findByText("Guided Pick")).toBeInTheDocument()
    expect(screen.getByText("2 items to pick")).toBeInTheDocument()
    expect(screen.getByTestId("start-picking")).toBeInTheDocument()
  })

  it("starts picking and shows first item", async () => {
    renderPage()
    const btn = await screen.findByTestId("start-picking")
    fireEvent.click(btn)

    expect(await screen.findByTestId("pick-step")).toBeInTheDocument()
    expect(screen.getByText("White Tee")).toBeInTheDocument()
    expect(screen.getByText("Colorway: Ivory")).toBeInTheDocument()
    expect(screen.getByTestId("pick-outcome-bar")).toBeInTheDocument()
  })

  it("advances to next item on Picked", async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId("start-picking"))
    fireEvent.click(await screen.findByTestId("pick-picked"))

    expect(await screen.findByText("Blue Jean")).toBeInTheDocument()
  })

  it("advances to completion after all items", async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId("start-picking"))
    // Pick both items
    fireEvent.click(await screen.findByTestId("pick-picked"))
    fireEvent.click(await screen.findByTestId("pick-not-available"))

    expect(await screen.findByText("Pick Complete")).toBeInTheDocument()
    expect(screen.getByText("Picked")).toBeInTheDocument()
  })

  it("shows substitute note input", async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId("start-picking"))
    fireEvent.click(await screen.findByTestId("pick-substitute"))

    expect(await screen.findByTestId("confirm-substitute")).toBeInTheDocument()
  })

  it("action buttons have >= 64px height", async () => {
    renderPage()
    fireEvent.click(await screen.findByTestId("start-picking"))

    const pickedBtn = await screen.findByTestId("pick-picked")
    expect(pickedBtn.className).toContain("min-h-[64px]")
  })
})
