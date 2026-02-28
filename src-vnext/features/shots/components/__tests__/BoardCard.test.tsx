/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"
import { BoardCard } from "@/features/shots/components/BoardCard"

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (candidate: string | undefined) => candidate ?? null,
}))

vi.mock("@/shared/lib/tagCategories", () => ({
  resolveShotTagCategory: (tag: { category?: string }) =>
    tag.category ?? "other",
}))

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Test Shot",
    projectId: "p1",
    clientId: "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    sortOrder: 0,
    shotNumber: overrides.shotNumber,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  }
}

describe("BoardCard", () => {
  const defaultProps = {
    shot: makeShot(),
    isDragging: false,
    onOpenShot: vi.fn(),
  }

  it("renders shot title", () => {
    render(<BoardCard {...defaultProps} shot={makeShot({ title: "Hero — Red Dress" })} />)
    expect(screen.getByText("Hero — Red Dress")).toBeInTheDocument()
  })

  it("renders shot number when present", () => {
    render(<BoardCard {...defaultProps} shot={makeShot({ shotNumber: "SH-014" })} />)
    expect(screen.getByText("#SH-014")).toBeInTheDocument()
  })

  it("renders 'Untitled Shot' when title is empty", () => {
    render(<BoardCard {...defaultProps} shot={makeShot({ title: "" })} />)
    expect(screen.getByText("Untitled Shot")).toBeInTheDocument()
  })

  it("renders tags (up to 3) with overflow indicator", () => {
    const tags = [
      { id: "t1", label: "campaign", color: "#333" },
      { id: "t2", label: "hero", color: "#444" },
      { id: "t3", label: "e-commerce", color: "#555" },
      { id: "t4", label: "seasonal", color: "#666" },
    ]
    render(<BoardCard {...defaultProps} shot={makeShot({ tags })} />)
    expect(screen.getByText("campaign")).toBeInTheDocument()
    expect(screen.getByText("hero")).toBeInTheDocument()
    expect(screen.getByText("e-commerce")).toBeInTheDocument()
    expect(screen.queryByText("seasonal")).not.toBeInTheDocument()
    expect(screen.getByText("+1")).toBeInTheDocument()
  })

  it("applies dragging styles when isDragging is true", () => {
    const { container } = render(<BoardCard {...defaultProps} isDragging />)
    const card = container.firstChild as HTMLElement
    expect(card.className).toMatch(/opacity-50/)
  })

  it("does not apply dragging styles when isDragging is false", () => {
    const { container } = render(<BoardCard {...defaultProps} isDragging={false} />)
    const card = container.firstChild as HTMLElement
    expect(card.className).not.toMatch(/opacity-50/)
  })

  it("calls onOpenShot when card is clicked", () => {
    const onOpenShot = vi.fn()
    render(<BoardCard {...defaultProps} onOpenShot={onOpenShot} shot={makeShot({ id: "shot-42" })} />)
    fireEvent.click(screen.getByText("Test Shot"))
    expect(onOpenShot).toHaveBeenCalledWith("shot-42")
  })

  it("renders hero thumbnail when heroImage has downloadURL", () => {
    const shot = makeShot({
      heroImage: { downloadURL: "https://example.com/hero.jpg", path: "" },
    })
    render(<BoardCard {...defaultProps} shot={shot} />)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("src", "https://example.com/hero.jpg")
  })

  it("renders camera placeholder when no hero image", () => {
    render(<BoardCard {...defaultProps} shot={makeShot()} />)
    expect(screen.queryByRole("img")).not.toBeInTheDocument()
    expect(screen.getByLabelText("No image")).toBeInTheDocument()
  })

  it("renders tags sorted by category (priority -> gender -> media -> other)", () => {
    const tags = [
      { id: "t1", label: "Lifestyle", color: "#333", category: "other" as const },
      { id: "t2", label: "High Priority", color: "#444", category: "priority" as const },
      { id: "t3", label: "Women", color: "#555", category: "gender" as const },
    ]
    render(<BoardCard {...defaultProps} shot={makeShot({ tags })} />)
    const tagElements = screen.getAllByText(/Lifestyle|High Priority|Women/)
    // Sorted: High Priority (priority) -> Women (gender) -> Lifestyle (other)
    expect(tagElements[0]).toHaveTextContent("High Priority")
    expect(tagElements[1]).toHaveTextContent("Women")
    expect(tagElements[2]).toHaveTextContent("Lifestyle")
  })
})
