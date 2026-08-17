import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { computeShotRowContext, renderShotCell } from "../shotColumnRenderers"
import type { Shot } from "@/shared/types"

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => "https://example.test/hero.jpg",
}))

const shotWithHero = {
  id: "shot-1",
  projectId: "p1",
  clientId: "c1",
  title: "Test Shot",
  status: "todo" as const,
  talent: [],
  products: [],
  sortOrder: 1,
  deleted: false,
  heroImage: { path: "shots/shot-1/hero.jpg", downloadURL: "https://example.test/hero.jpg" },
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
} as unknown as Shot

describe("shotColumnRenderers — hero thumb lazy loading", () => {
  it("renders the hero thumb with loading=\"lazy\" decoding=\"async\"", () => {
    const ctx = computeShotRowContext(shotWithHero, undefined, undefined, undefined, undefined, undefined)
    render(<>{renderShotCell(shotWithHero, "heroThumb", ctx)}</>)
    const img = screen.getByRole("img")
    expect(img).toHaveAttribute("loading", "lazy")
    expect(img).toHaveAttribute("decoding", "async")
  })
})
