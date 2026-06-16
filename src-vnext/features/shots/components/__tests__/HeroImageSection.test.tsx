import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { HeroImageSection } from "../HeroImageSection"
import type { Shot } from "@/shared/types"

const catalogMocks = vi.hoisted(() => ({
  family: { data: undefined as undefined | { id?: string; thumbnailImagePath?: string; headerImagePath?: string } },
  sku: { data: undefined as undefined | { id?: string; imagePath?: string } },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" }),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (candidate: string | undefined) => candidate ?? null,
}))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useProductFamilyDoc: () => catalogMocks.family,
  useProductSkuDoc: () => catalogMocks.sku,
}))

vi.mock("@/shared/lib/uploadImage", () => ({
  uploadHeroImage: vi.fn().mockResolvedValue({ path: "p", downloadURL: "u" }),
  validateImageFileForUpload: vi.fn().mockReturnValue(null),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

const baseShot = {
  id: "shot-1",
  projectId: "p1",
  clientId: "c1",
  title: "Test Shot",
  status: "todo" as const,
  talent: [],
  products: [],
  sortOrder: 1,
  deleted: false,
} as unknown as Shot

const heroImage = {
  path: "clients/c1/shots/shot-1/hero.webp",
  downloadURL: "https://example.test/hero.webp",
} as Shot["heroImage"]

const coverShot = {
  ...(baseShot as object),
  activeLookId: "look-1",
  looks: [
    { id: "look-1", products: [{ familyId: "fam-X", familyName: "Tee" }], heroProductId: "fam-X" },
  ],
} as unknown as Shot

beforeEach(() => {
  catalogMocks.family = { data: undefined }
  catalogMocks.sku = { data: undefined }
})

describe("HeroImageSection frame variants", () => {
  it('default "fixed" frame keeps the legacy fixed-height container', () => {
    render(
      <HeroImageSection heroImage={heroImage} shot={baseShot} shotId="shot-1" canUpload={false} />,
    )
    const img = screen.getByAltText("Hero")
    expect(img).toHaveClass("h-full", "w-full", "object-contain")
    expect(img.parentElement).toHaveClass("h-[clamp(210px,30vh,320px)]", "w-full")
  })

  it('"natural" frame renders the image at its native ratio, height-capped', () => {
    render(
      <HeroImageSection
        heroImage={heroImage}
        shot={baseShot}
        shotId="shot-1"
        canUpload={false}
        frame="natural"
      />,
    )
    const img = screen.getByAltText("Hero")
    expect(img).toHaveClass("h-auto", "w-auto", "max-h-[460px]", "object-contain")
    expect(img.parentElement).toHaveClass("max-h-[460px]")
    expect(img.parentElement?.parentElement).toHaveClass("w-fit")
  })

  it('"natural" frame keeps the Replace/Reset upload affordances when canUpload is true', () => {
    render(
      <HeroImageSection
        heroImage={heroImage}
        shot={baseShot}
        shotId="shot-1"
        canUpload={true}
        frame="natural"
      />,
    )
    expect(screen.getByRole("button", { name: /Replace/ })).toBeInTheDocument()
  })

  it('"natural" frame does not change the empty state or upload gating', () => {
    render(
      <HeroImageSection
        heroImage={undefined}
        shot={baseShot}
        shotId="shot-1"
        canUpload={true}
        frame="natural"
      />,
    )
    expect(screen.getByText("Add hero image")).toBeInTheDocument()
    expect(screen.getByTestId("hero-image-file-input")).toBeInTheDocument()
  })
})

describe("HeroImageSection cover-product fallback", () => {
  it("renders the explicit cover product's catalog image when no hero image is resolved", () => {
    catalogMocks.family = { data: { id: "fam-X", thumbnailImagePath: "clients/c1/products/fam-X/thumb.webp" } }
    render(<HeroImageSection heroImage={undefined} shot={coverShot} shotId="shot-1" canUpload={true} />)
    const img = screen.getByAltText("Hero")
    expect(img).toHaveAttribute("src", "clients/c1/products/fam-X/thumb.webp")
    expect(screen.queryByText("Add hero image")).not.toBeInTheDocument()
  })

  it("ignores stale catalog doc data carried over from a different product id", () => {
    catalogMocks.family = { data: { id: "fam-OTHER", thumbnailImagePath: "clients/c1/products/fam-OTHER/thumb.webp" } }
    render(<HeroImageSection heroImage={undefined} shot={coverShot} shotId="shot-1" canUpload={true} />)
    expect(screen.queryByAltText("Hero")).not.toBeInTheDocument()
    expect(screen.getByText("Add hero image")).toBeInTheDocument()
  })

  it("does not fall back when the cover product was explicitly cleared", () => {
    catalogMocks.family = { data: { thumbnailImagePath: "clients/c1/products/fam-X/thumb.webp" } }
    const cleared = {
      ...(coverShot as object),
      looks: [{ id: "look-1", products: [{ familyId: "fam-X" }], heroProductId: null }],
    } as unknown as Shot
    render(<HeroImageSection heroImage={undefined} shot={cleared} shotId="shot-1" canUpload={true} />)
    expect(screen.queryByAltText("Hero")).not.toBeInTheDocument()
    expect(screen.getByText("Add hero image")).toBeInTheDocument()
  })

  it("falls back gracefully to the empty state when the cover product has no catalog image", () => {
    render(<HeroImageSection heroImage={undefined} shot={coverShot} shotId="shot-1" canUpload={true} />)
    expect(screen.queryByAltText("Hero")).not.toBeInTheDocument()
    expect(screen.getByText("Add hero image")).toBeInTheDocument()
  })

  it("uses the resolved hero image and ignores the cover fallback when both exist", () => {
    catalogMocks.family = { data: { thumbnailImagePath: "clients/c1/products/fam-X/thumb.webp" } }
    render(<HeroImageSection heroImage={heroImage} shot={coverShot} shotId="shot-1" canUpload={false} />)
    const img = screen.getByAltText("Hero")
    expect(img).toHaveAttribute("src", "https://example.test/hero.webp")
  })
})
