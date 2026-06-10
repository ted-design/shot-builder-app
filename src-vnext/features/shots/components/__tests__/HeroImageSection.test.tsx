import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { HeroImageSection } from "../HeroImageSection"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" }),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (candidate: string | undefined) => candidate ?? null,
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
