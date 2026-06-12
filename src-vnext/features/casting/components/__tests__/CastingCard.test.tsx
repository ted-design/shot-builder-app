/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { CastingBoardEntry, TalentRecord } from "@/shared/types"

// useStorageUrl echoes its candidate path (or undefined) so a thumb's path
// becomes its <img> src in the rendered output.
vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (path: string | undefined) => path ?? undefined,
}))

vi.mock("@/shared/hooks/useMeasurementUnits", () => ({
  useMeasurementUnits: () => ({ system: "imperial" }),
}))

import { CastingCard } from "@/features/casting/components/CastingCard"

function makeEntry(overrides: Partial<CastingBoardEntry>): CastingBoardEntry {
  return {
    id: overrides.id ?? "t1",
    talentId: overrides.talentId ?? "t1",
    talentName: overrides.talentName ?? "Talent One",
    talentAgency: overrides.talentAgency ?? null,
    status: overrides.status ?? "shortlist",
    notes: overrides.notes ?? null,
    roleLabel: overrides.roleLabel ?? null,
    hiddenImageIds: overrides.hiddenImageIds,
    hiddenSessionIds: overrides.hiddenSessionIds,
    sortOrder: overrides.sortOrder ?? 0,
    addedBy: overrides.addedBy ?? "u1",
    addedAt: overrides.addedAt,
    updatedAt: overrides.updatedAt,
  }
}

function makeTalent(overrides: Partial<TalentRecord>): TalentRecord {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Talent One",
    headshotPath: overrides.headshotPath ?? null,
    galleryImages: overrides.galleryImages,
    castingSessions: overrides.castingSessions,
    ...overrides,
  } as TalentRecord
}

const noop = () => {}

function renderCard(
  talent: TalentRecord | null,
  entry: CastingBoardEntry,
  onClick = noop,
) {
  return render(
    <CastingCard
      entry={entry}
      talent={talent}
      selected={false}
      canEdit={false}
      onClick={onClick}
      onSelect={noop}
      onStatusChange={noop}
      onBook={noop}
      onRemove={noop}
    />,
  )
}

describe("CastingCard image strip", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders no strip when the talent has no gallery/session images (headshot only)", () => {
    renderCard(makeTalent({}), makeEntry({}))
    expect(
      screen.queryByRole("button", { name: /View .* image/ }),
    ).not.toBeInTheDocument()
  })

  it("renders a thumbnail strip for visible gallery + session images", () => {
    const talent = makeTalent({
      galleryImages: [{ id: "g1", path: "p/g1.jpg" }],
      castingSessions: [
        {
          id: "s1",
          date: "2026-01-01",
          images: [{ id: "s1i1", path: "p/s1i1.jpg" }],
        },
      ],
    })
    renderCard(talent, makeEntry({}))

    const strip = screen.getByRole("button", { name: /View 2 images/ })
    expect(strip).toBeInTheDocument()
    const imgs = strip.querySelectorAll("img")
    expect(imgs).toHaveLength(2)
    expect(imgs[0]).toHaveAttribute("src", "p/g1.jpg")
    expect(imgs[1]).toHaveAttribute("src", "p/s1i1.jpg")
  })

  it("hides curated images from the strip", () => {
    const talent = makeTalent({
      galleryImages: [
        { id: "g1", path: "p/g1.jpg" },
        { id: "g2", path: "p/g2.jpg" },
      ],
    })
    renderCard(talent, makeEntry({ hiddenImageIds: ["g1"] }))

    const strip = screen.getByRole("button", { name: /View 1 image/ })
    const imgs = strip.querySelectorAll("img")
    expect(imgs).toHaveLength(1)
    expect(imgs[0]).toHaveAttribute("src", "p/g2.jpg")
  })

  it("caps the strip at 4 thumbs and shows a +N overflow chip", () => {
    const talent = makeTalent({
      galleryImages: [
        { id: "g1", path: "p/g1.jpg" },
        { id: "g2", path: "p/g2.jpg" },
        { id: "g3", path: "p/g3.jpg" },
        { id: "g4", path: "p/g4.jpg" },
        { id: "g5", path: "p/g5.jpg" },
        { id: "g6", path: "p/g6.jpg" },
      ],
    })
    renderCard(talent, makeEntry({}))

    const strip = screen.getByRole("button", { name: /View 6 images/ })
    expect(strip.querySelectorAll("img")).toHaveLength(4)
    expect(screen.getByText("+2")).toBeInTheDocument()
  })

  it("renders no strip when every extra image is hidden", () => {
    const talent = makeTalent({
      galleryImages: [{ id: "g1", path: "p/g1.jpg" }],
      castingSessions: [
        {
          id: "s1",
          date: "2026-01-01",
          images: [{ id: "s1i1", path: "p/s1i1.jpg" }],
        },
      ],
    })
    renderCard(
      talent,
      makeEntry({ hiddenImageIds: ["g1"], hiddenSessionIds: ["s1"] }),
    )
    expect(
      screen.queryByRole("button", { name: /View .* image/ }),
    ).not.toBeInTheDocument()
  })

  it("fires onClick (open detail sheet) when a thumb strip is clicked", () => {
    const onClick = vi.fn()
    const talent = makeTalent({
      galleryImages: [{ id: "g1", path: "p/g1.jpg" }],
    })
    renderCard(talent, makeEntry({}), onClick)

    fireEvent.click(screen.getByRole("button", { name: /View 1 image/ }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
