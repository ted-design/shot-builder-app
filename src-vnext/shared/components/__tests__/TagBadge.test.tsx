/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/shared/lib/tagCategories", () => ({
  resolveShotTagCategory: (tag: { category?: string }) =>
    tag.category ?? "other",
}))

import { TagBadge } from "@/shared/components/TagBadge"
import type { ShotTag } from "@/shared/types"

function makeTag(overrides: Partial<ShotTag> = {}): ShotTag {
  return {
    id: overrides.id ?? "t1",
    label: overrides.label ?? "Test Tag",
    color: overrides.color ?? "#333",
    category: overrides.category,
  }
}

describe("TagBadge", () => {
  it("renders tag label text", () => {
    render(<TagBadge tag={makeTag({ label: "Hero Shot" })} />)
    expect(screen.getByText("Hero Shot")).toBeInTheDocument()
  })

  it("returns null for empty label", () => {
    const { container } = render(<TagBadge tag={makeTag({ label: "" })} />)
    expect(container.firstChild).toBeNull()
  })

  it("returns null for whitespace-only label", () => {
    const { container } = render(<TagBadge tag={makeTag({ label: "   " })} />)
    expect(container.firstChild).toBeNull()
  })

  it("shows remove button when onRemove is provided", () => {
    render(<TagBadge tag={makeTag()} onRemove={vi.fn()} />)
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument()
  })

  it("does not show remove button when onRemove is not provided", () => {
    render(<TagBadge tag={makeTag()} />)
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("calls onRemove with tag when remove button clicked", () => {
    const tag = makeTag({ id: "t42", label: "Remove Me" })
    const onRemove = vi.fn()
    render(<TagBadge tag={tag} onRemove={onRemove} />)
    fireEvent.click(screen.getByRole("button", { name: /remove/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
    expect(onRemove).toHaveBeenCalledWith(tag)
  })

  it("has border-l-[2.5px] class (left border width)", () => {
    const { container } = render(<TagBadge tag={makeTag()} />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-[2.5px]")
  })

  it("applies border-l-red-500 class for category='priority'", () => {
    const { container } = render(
      <TagBadge tag={makeTag({ category: "priority" })} />,
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-red-500")
  })

  it("applies border-l-blue-500 class for category='gender'", () => {
    const { container } = render(
      <TagBadge tag={makeTag({ category: "gender" })} />,
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-blue-500")
  })

  it("applies border-l-emerald-500 class for category='media'", () => {
    const { container } = render(
      <TagBadge tag={makeTag({ category: "media" })} />,
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-emerald-500")
  })

  it("applies border-l-neutral-400 class for category='other'", () => {
    const { container } = render(
      <TagBadge tag={makeTag({ category: "other" })} />,
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-neutral-400")
  })

  it("applies border-l-neutral-400 class when category is undefined", () => {
    const { container } = render(
      <TagBadge tag={makeTag({ category: undefined })} />,
    )
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain("border-l-neutral-400")
  })
})
