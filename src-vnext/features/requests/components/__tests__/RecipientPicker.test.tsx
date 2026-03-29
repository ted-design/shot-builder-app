/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// ---- Mocks ----

const mockUseFirestoreCollection = vi.fn()

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: (...args: unknown[]) => mockUseFirestoreCollection(...args),
}))

vi.mock("@/shared/lib/paths", () => ({
  usersPath: (clientId: string) => ["clients", clientId, "users"],
}))

import { RecipientPicker } from "../RecipientPicker"

const adminUser = { id: "uid-admin", displayName: "Alice Admin", email: "alice@example.com", role: "admin" }
const producerUser = { id: "uid-prod", displayName: "Bob Producer", email: "bob@example.com", role: "producer" }
const crewUser = { id: "uid-crew", displayName: "Carol Crew", email: "carol@example.com", role: "crew" }

describe("RecipientPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders admin and producer users only", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser, crewUser],
      loading: false,
    })

    render(
      <RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />,
    )

    expect(screen.getByTitle("Alice Admin")).toBeInTheDocument()
    expect(screen.getByTitle("Bob Producer")).toBeInTheDocument()
    expect(screen.queryByTitle("Carol Crew")).not.toBeInTheDocument()
  })

  it("shows loading skeleton when loading", () => {
    mockUseFirestoreCollection.mockReturnValue({ data: [], loading: true })

    const { container } = render(
      <RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />,
    )

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(3)
  })

  it("shows empty state message when no eligible users", () => {
    mockUseFirestoreCollection.mockReturnValue({ data: [crewUser], loading: false })

    render(
      <RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />,
    )

    expect(
      screen.getByText("No team leads available to notify."),
    ).toBeInTheDocument()
  })

  it("shows default help text when nothing selected", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    render(<RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />)

    expect(
      screen.getByText("Leave unchecked to notify all team leads"),
    ).toBeInTheDocument()
  })

  it("shows targeted help text when users selected", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    render(
      <RecipientPicker clientId="c1" value={["uid-admin"]} onChange={vi.fn()} />,
    )

    expect(
      screen.getByText("Notifying Alice Admin only"),
    ).toBeInTheDocument()
  })

  it("calls onChange with uid added on avatar click", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    const onChange = vi.fn()
    render(<RecipientPicker clientId="c1" value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByTitle("Alice Admin"))

    expect(onChange).toHaveBeenCalledWith(["uid-admin"])
  })

  it("calls onChange with uid removed when deselecting", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    const onChange = vi.fn()
    render(
      <RecipientPicker clientId="c1" value={["uid-admin"]} onChange={onChange} />,
    )

    fireEvent.click(screen.getByTitle("Alice Admin"))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it("Select All selects all eligible users", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    const onChange = vi.fn()
    render(<RecipientPicker clientId="c1" value={[]} onChange={onChange} />)

    fireEvent.click(screen.getByText("Select All"))

    expect(onChange).toHaveBeenCalledWith(["uid-admin", "uid-prod"])
  })

  it("shows Clear All button when all selected", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    render(
      <RecipientPicker
        clientId="c1"
        value={["uid-admin", "uid-prod"]}
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByText("Clear All")).toBeInTheDocument()
    expect(screen.queryByText("Select All")).not.toBeInTheDocument()
  })

  it("Clear All deselects all users", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser, producerUser],
      loading: false,
    })

    const onChange = vi.fn()
    render(
      <RecipientPicker
        clientId="c1"
        value={["uid-admin", "uid-prod"]}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByText("Clear All"))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it("selected avatar has ring styling", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser],
      loading: false,
    })

    render(
      <RecipientPicker clientId="c1" value={["uid-admin"]} onChange={vi.fn()} />,
    )

    const avatar = screen.getByTitle("Alice Admin")
    expect(avatar.className).toContain("ring-2")
  })

  it("shows initials from displayName", () => {
    mockUseFirestoreCollection.mockReturnValue({
      data: [adminUser],
      loading: false,
    })

    render(<RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />)

    // "Alice Admin" → "AA"
    expect(screen.getByTitle("Alice Admin").textContent).toBe("AA")
  })

  it("falls back to email initial when displayName is absent", () => {
    const noNameUser = { id: "uid-x", displayName: null, email: "zara@example.com", role: "admin" }
    mockUseFirestoreCollection.mockReturnValue({ data: [noNameUser], loading: false })

    render(<RecipientPicker clientId="c1" value={[]} onChange={vi.fn()} />)

    expect(screen.getByTitle("zara@example.com").textContent).toBe("Z")
  })
})
