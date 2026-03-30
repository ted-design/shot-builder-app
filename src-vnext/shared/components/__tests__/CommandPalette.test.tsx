/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

// ---------------------------------------------------------------------------
// Mocks (declared before imports that depend on them)
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "admin", clientId: "c1" }),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Alpha Project", clientId: "c1", status: "active", shootDates: [] },
    ],
  }),
}))

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductFamilies: () => ({
    data: [
      { id: "f1", styleName: "Beta Jacket", styleNumbers: ["BJ-001"] },
    ],
  }),
}))

vi.mock("@/features/library/hooks/useTalentLibrary", () => ({
  useTalentLibrary: () => ({
    data: [
      { id: "t1", name: "Jane Doe", agency: "Top Agency" },
    ],
  }),
}))

vi.mock("@/features/library/hooks/useCrewLibrary", () => ({
  useCrewLibrary: () => ({
    data: [
      { id: "cr1", name: "Bob Smith", position: "Director of Photography" },
    ],
  }),
}))

vi.mock("@/shared/lib/rbac", () => ({
  ROLE: { ADMIN: "admin", PRODUCER: "producer", CREW: "crew", WAREHOUSE: "warehouse", VIEWER: "viewer" },
}))

// ---------------------------------------------------------------------------
// Now import subject under test
// ---------------------------------------------------------------------------

import { SearchCommandProvider, useSearchCommand } from "@/app/providers/SearchCommandProvider"
import { CommandPalette } from "@/shared/components/CommandPalette"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function PaletteHarness({ initialOpen = false }: { readonly initialOpen?: boolean }) {
  return (
    <SearchCommandProvider>
      <OpenController initialOpen={initialOpen} />
      <CommandPalette />
    </SearchCommandProvider>
  )
}

function OpenController({ initialOpen }: { readonly initialOpen: boolean }) {
  const { setOpen } = useSearchCommand()
  return (
    <button type="button" onClick={() => setOpen(initialOpen)}>
      {initialOpen ? "open-palette" : "close-palette"}
    </button>
  )
}

function renderOpen() {
  const result = render(<PaletteHarness initialOpen />)
  fireEvent.click(screen.getByText("open-palette"))
  return result
}

// ---------------------------------------------------------------------------
// SearchCommandProvider tests
// ---------------------------------------------------------------------------

describe("SearchCommandProvider", () => {
  it("starts with open=false", () => {
    let capturedOpen: boolean | undefined
    function Inspector() {
      const { open } = useSearchCommand()
      capturedOpen = open
      return null
    }
    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )
    expect(capturedOpen).toBe(false)
  })

  it("setOpen(true) transitions open to true", () => {
    let capturedOpen: boolean | undefined
    let capturedSetOpen: ((v: boolean) => void) | undefined

    function Inspector() {
      const { open, setOpen } = useSearchCommand()
      capturedOpen = open
      capturedSetOpen = setOpen
      return null
    }

    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )

    act(() => capturedSetOpen!(true))
    expect(capturedOpen).toBe(true)
  })

  it("setOpen(false) transitions open back to false", () => {
    let capturedOpen: boolean | undefined
    let capturedSetOpen: ((v: boolean) => void) | undefined

    function Inspector() {
      const { open, setOpen } = useSearchCommand()
      capturedOpen = open
      capturedSetOpen = setOpen
      return null
    }

    render(
      <SearchCommandProvider>
        <Inspector />
      </SearchCommandProvider>,
    )

    act(() => capturedSetOpen!(true))
    expect(capturedOpen).toBe(true)
    act(() => capturedSetOpen!(false))
    expect(capturedOpen).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CommandPalette rendering tests
// ---------------------------------------------------------------------------

describe("CommandPalette", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it("renders the palette when open", () => {
    renderOpen()
    expect(
      screen.getByPlaceholderText("Search projects, products, talent, crew..."),
    ).toBeInTheDocument()
  })

  it("does not render palette content when closed", () => {
    render(<PaletteHarness initialOpen={false} />)
    // dialog should not be open
    expect(
      screen.queryByPlaceholderText("Search projects, products, talent, crew..."),
    ).not.toBeInTheDocument()
  })

  it("shows Quick Actions when query is empty", () => {
    renderOpen()
    expect(screen.getByText("Create new project")).toBeInTheDocument()
    expect(screen.getByText("Create new shot request")).toBeInTheDocument()
    expect(screen.getByText("Go to Products")).toBeInTheDocument()
  })

  it("shows 'Go to Admin' for admin role", () => {
    renderOpen()
    expect(screen.getByText("Go to Admin")).toBeInTheDocument()
  })

  it("shows search results matching a project query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    expect(await screen.findByText("Alpha Project")).toBeInTheDocument()
  })

  it("shows search results matching a product query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Beta" } })
    expect(await screen.findByText("Beta Jacket")).toBeInTheDocument()
  })

  it("shows search results matching a talent query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Jane" } })
    expect(await screen.findByText("Jane Doe")).toBeInTheDocument()
  })

  it("shows search results matching a crew query", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Bob" } })
    expect(await screen.findByText("Bob Smith")).toBeInTheDocument()
  })

  it("navigates to project path on project item selection", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    const item = await screen.findByText("Alpha Project")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/projects/p1/shots")
  })

  it("navigates to product path on product item selection", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Beta" } })
    const item = await screen.findByText("Beta Jacket")
    fireEvent.click(item)
    expect(mockNavigate).toHaveBeenCalledWith("/products/f1")
  })

  it("navigates to /projects when 'Create new project' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Create new project"))
    expect(mockNavigate).toHaveBeenCalledWith("/projects")
  })

  it("navigates to /requests when 'Create new shot request' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Create new shot request"))
    expect(mockNavigate).toHaveBeenCalledWith("/requests")
  })

  it("navigates to /admin when 'Go to Admin' is selected", () => {
    renderOpen()
    fireEvent.click(screen.getByText("Go to Admin"))
    expect(mockNavigate).toHaveBeenCalledWith("/admin")
  })

  it("stores navigated item in localStorage recent items", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    const item = await screen.findByText("Alpha Project")
    fireEvent.click(item)
    const stored = JSON.parse(localStorage.getItem("sb:cmd-recent") ?? "[]")
    expect(stored).toHaveLength(1)
    expect(stored[0].id).toBe("p1")
    expect(stored[0].type).toBe("project")
    expect(stored[0].name).toBe("Alpha Project")
  })

  it("retrieves recent items from localStorage on open", () => {
    const recentData = [
      { id: "p99", type: "project", name: "Old Project", navigateTo: "/projects/p99/shots" },
    ]
    localStorage.setItem("sb:cmd-recent", JSON.stringify(recentData))
    renderOpen()
    expect(screen.getByText("Old Project")).toBeInTheDocument()
  })

  it("Cmd+K keyboard shortcut triggers open via document event", () => {
    let capturedOpen: boolean | undefined
    function Inspector() {
      const { open } = useSearchCommand()
      capturedOpen = open
      return null
    }
    render(
      <SearchCommandProvider>
        <Inspector />
        <CommandPalette />
      </SearchCommandProvider>,
    )
    expect(capturedOpen).toBe(false)
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }),
      )
    })
    expect(capturedOpen).toBe(true)
  })

  it("renders FolderOpen icon for project results", async () => {
    renderOpen()
    const input = screen.getByPlaceholderText("Search projects, products, talent, crew...")
    fireEvent.change(input, { target: { value: "Alpha" } })
    await screen.findByText("Alpha Project")
    // lucide-react renders svg with data-testid or class; check icon presence via svg in the list item
    const projectItem = screen.getByText("Alpha Project").closest("[cmdk-item]")
    expect(projectItem?.querySelector("svg")).toBeInTheDocument()
  })
})
