/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { CastingBoardEntry, TalentRecord } from "@/shared/types"

// useStorageUrl echoes its candidate path back so a passed `path` becomes the
// rendered img src (matches the established repo mock shape).
vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (candidate: string | undefined) => candidate ?? null,
}))

// Keep the measurement chrome inert — not under test here.
vi.mock("@/shared/hooks/useMeasurementUnits", () => ({
  useMeasurementUnits: () => ({ system: "imperial", setSystem: vi.fn() }),
}))

vi.mock("@/features/library/components/MeasurementUnitToggle", () => ({
  MeasurementUnitToggle: () => null,
}))

vi.mock("@/features/casting/lib/castingWrites", () => ({
  updateCastingEntryVisibility: vi.fn(),
}))

import { updateCastingEntryVisibility } from "@/features/casting/lib/castingWrites"
import { AdminTalentDetailSheet } from "@/features/casting/components/AdminTalentDetailSheet"

function makeTalent(overrides: Partial<TalentRecord> = {}): TalentRecord {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Talent One",
    galleryImages: overrides.galleryImages ?? [
      { id: "g1", path: "gallery/g1.jpg", downloadURL: "https://cdn/g1.jpg" },
      { id: "g2", path: "gallery/g2.jpg" },
    ],
    castingSessions: overrides.castingSessions ?? [
      {
        id: "s1",
        date: "2026-01-15",
        title: "Winter Session",
        images: [
          { id: "i1", path: "sessions/i1.jpg", downloadURL: "https://cdn/i1.jpg" },
          { id: "i2", path: "sessions/i2.jpg" },
        ],
      },
    ],
    ...overrides,
  } as TalentRecord
}

function makeEntry(overrides: Partial<CastingBoardEntry> = {}): CastingBoardEntry {
  return {
    id: overrides.id ?? "t1",
    talentId: overrides.talentId ?? "t1",
    talentName: overrides.talentName ?? "Talent One",
    talentAgency: overrides.talentAgency ?? null,
    status: overrides.status ?? "shortlist",
    notes: overrides.notes ?? null,
    roleLabel: overrides.roleLabel ?? null,
    sortOrder: overrides.sortOrder ?? 0,
    addedBy: overrides.addedBy ?? "u1",
    addedAt: overrides.addedAt,
    updatedAt: overrides.updatedAt,
    hiddenImageIds: overrides.hiddenImageIds,
    hiddenSessionIds: overrides.hiddenSessionIds,
  }
}

describe("AdminTalentDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the gallery and a casting-session folder", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry()}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    expect(screen.getByText("Portfolio")).toBeInTheDocument()
    expect(screen.getByText("Winter Session")).toBeInTheDocument()
    // 2 gallery + 2 session = 4 image tiles rendered
    const imgs = screen.getAllByRole("img")
    // headshot is absent (no headshotPath); 4 board images present
    expect(imgs.length).toBe(4)
  })

  it("eye toggle adds the image id to hiddenImageIds", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: [], hiddenSessionIds: [] })}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    // First gallery tile's hide button.
    const hideButtons = screen.getAllByRole("button", { name: "Hide image" })
    fireEvent.click(hideButtons[0]!)

    expect(updateCastingEntryVisibility).toHaveBeenCalledTimes(1)
    expect(updateCastingEntryVisibility).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: ["g1"],
      hiddenSessionIds: [],
    })
  })

  it("folder toggle adds the session id to hiddenSessionIds", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: [], hiddenSessionIds: [] })}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Hide folder" }))

    expect(updateCastingEntryVisibility).toHaveBeenCalledTimes(1)
    expect(updateCastingEntryVisibility).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: [],
      hiddenSessionIds: ["s1"],
    })
  })

  it("un-hides an already-hidden image (removes id from the array)", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: ["g1"], hiddenSessionIds: [] })}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Show image" }))

    expect(updateCastingEntryVisibility).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: [],
      hiddenSessionIds: [],
    })
  })

  it("disables the per-image toggle for a folder-hidden image (Codex P2)", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: [], hiddenSessionIds: ["s1"] })}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    // The session folder is shown in edit mode; its child image toggles are
    // inert ("hidden via folder") so clicking them can't strand an id in
    // hiddenImageIds. There are two such images (i1, i2).
    const inertToggles = screen.getAllByRole("button", {
      name: "Hidden via folder — toggle the folder to show",
    })
    expect(inertToggles).toHaveLength(2)
    inertToggles.forEach((b) => expect(b).toBeDisabled())

    fireEvent.click(inertToggles[0]!)
    expect(updateCastingEntryVisibility).not.toHaveBeenCalled()

    // The folder toggle itself is the control (folder currently hidden → "Show folder").
    expect(screen.getByRole("button", { name: "Show folder" })).toBeInTheDocument()
    // Gallery images are unaffected — still individually hideable.
    expect(screen.getAllByRole("button", { name: "Hide image" })).toHaveLength(2)
  })

  it("composes rapid successive toggles via optimistic state (no dropped write)", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: [], hiddenSessionIds: [] })}
        voteAggregate={null}
        canEdit
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    // Hide g1 (the write mock never updates the `entry` prop, simulating the
    // Firestore round-trip latency window).
    fireEvent.click(screen.getAllByRole("button", { name: "Hide image" })[0]!)
    // g1 is now optimistically hidden; the next "Hide image" button is g2.
    fireEvent.click(screen.getAllByRole("button", { name: "Hide image" })[0]!)

    expect(updateCastingEntryVisibility).toHaveBeenCalledTimes(2)
    // The SECOND write must include BOTH ids — the pre-fix code, computing from
    // the stale entry prop, would have written only ["g2"] and dropped g1.
    expect(updateCastingEntryVisibility).toHaveBeenLastCalledWith({
      clientId: "c1",
      projectId: "p1",
      talentId: "t1",
      hiddenImageIds: ["g1", "g2"],
      hiddenSessionIds: [],
    })
  })

  it("read-only (canEdit=false) shows no toggles and hides hidden images", () => {
    render(
      <AdminTalentDetailSheet
        talent={makeTalent()}
        entry={makeEntry({ hiddenImageIds: ["g1"], hiddenSessionIds: ["s1"] })}
        voteAggregate={null}
        canEdit={false}
        clientId="c1"
        projectId="p1"
        open
        onOpenChange={() => {}}
      />,
    )

    // No eye toggles at all.
    expect(screen.queryByRole("button", { name: "Hide image" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Show image" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Hide folder" })).toBeNull()

    // The whole session is hidden (s1) → its heading is gone.
    expect(screen.queryByText("Winter Session")).toBeNull()
    // Hidden gallery image g1 filtered out; only g2 remains visible.
    const imgs = screen.getAllByRole("img")
    expect(imgs.length).toBe(1)
    expect(imgs[0]!.getAttribute("src")).toBe("gallery/g2.jpg")
  })
})
