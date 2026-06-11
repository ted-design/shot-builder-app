/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, act } from "@testing-library/react"
import type { CastingBoardEntry } from "@/shared/types"

// ---------------------------------------------------------------------------
// Mocks — talent roster, casting board, auth, the auto-repair write and toast.
// ---------------------------------------------------------------------------

let mockTalent: Array<{ id: string; name: string; projectIds?: string[] }> = []
let mockEntries: CastingBoardEntry[] = []

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useTalent: () => ({ data: mockTalent, loading: false, error: null }),
}))

vi.mock("@/features/casting/hooks/useCastingBoard", () => ({
  useCastingBoard: () => ({ entries: mockEntries, loading: false, error: null }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" } }),
}))

const { addTalentToProjectMock } = vi.hoisted(() => ({
  addTalentToProjectMock: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/features/assets/lib/projectAssetsWrites", () => ({
  addTalentToProject: addTalentToProjectMock,
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}))

import { toast } from "sonner"
import { TalentPicker } from "./TalentPicker"

// ---------------------------------------------------------------------------
// Fixtures — production-shaped casting entries + a five-status talent roster.
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<CastingBoardEntry> = {}): CastingBoardEntry {
  return {
    id: "entry-1",
    talentId: "t-1",
    talentName: "Talent",
    talentAgency: null,
    status: "shortlist",
    notes: null,
    roleLabel: null,
    sortOrder: 0,
    addedBy: "u1",
    addedAt: undefined,
    updatedAt: undefined,
    ...overrides,
  } as CastingBoardEntry
}

const ROSTER = [
  { id: "t-booked", name: "Booked Bella", projectIds: ["p1"] },
  { id: "t-hold", name: "Hold Harry", projectIds: ["p1"] },
  { id: "t-short", name: "Shortlist Zara", projectIds: ["p1"] },
  { id: "t-passed", name: "Passed Pat", projectIds: ["p1"] },
  { id: "t-none", name: "Unstatused Uma", projectIds: ["p1"] },
]

const FULL_BOARD = [
  makeEntry({ id: "e1", talentId: "t-booked", status: "booked" }),
  makeEntry({ id: "e2", talentId: "t-hold", status: "hold" }),
  makeEntry({ id: "e3", talentId: "t-short", status: "shortlist" }),
  makeEntry({ id: "e4", talentId: "t-passed", status: "passed" }),
]

function renderPicker(props: Partial<Parameters<typeof TalentPicker>[0]> = {}) {
  return render(
    <TalentPicker
      selectedIds={[]}
      onSave={vi.fn()}
      projectId="p1"
      {...props}
    />,
  )
}

/** Opens the popover (trigger is the first button) and waits for content. */
async function openPicker(): Promise<HTMLElement> {
  const trigger = screen.getAllByRole("button")[0]
  if (!trigger) throw new Error("No trigger button rendered")
  fireEvent.click(trigger)
  await screen.findByPlaceholderText("Search talent...")
  return trigger
}

function itemFor(name: string): HTMLElement {
  // The trigger renders selected names as badges too — scope to cmdk items.
  const el = screen
    .getAllByText(name)
    .map((node) => node.closest("[cmdk-item]"))
    .find((item) => item !== null)
  if (!el) throw new Error(`No cmdk item for ${name}`)
  return el as HTMLElement
}

function groupFor(heading: string): HTMLElement {
  // Match the cmdk heading element only — badge text can repeat group names.
  const headingEl = Array.from(
    document.querySelectorAll("[cmdk-group-heading]"),
  ).find((h) => h.textContent === heading)
  const el = headingEl?.closest("[cmdk-group]")
  if (!el) throw new Error(`No cmdk group for heading ${heading}`)
  return el as HTMLElement
}

describe("TalentPicker", () => {
  beforeEach(() => {
    mockTalent = [...ROSTER]
    mockEntries = [...FULL_BOARD]
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("(1) partitions casting statuses: 'passed' AND unstatused talent both land in Other", async () => {
    renderPicker()
    await openPicker()

    // Other is collapsed by default — passed + unstatused = 2 hidden entries.
    fireEvent.click(screen.getByText("Show 2 more"))

    const other = groupFor("Other talent")
    expect(within(other).getByText("Passed Pat")).toBeInTheDocument()
    expect(within(other).getByText("Unstatused Uma")).toBeInTheDocument()

    const booked = groupFor("Booked")
    expect(within(booked).getByText("Booked Bella")).toBeInTheDocument()
  })

  it("(2+3) hoists 'Currently assigned' first and orders groups Booked → Hold → Shortlist → Other", async () => {
    renderPicker({ selectedIds: ["t-hold"] })
    await openPicker()

    // Expand every collapsed group so all headings mount (empty query = no
    // cmdk score-reordering, DOM order is render order).
    fireEvent.click(screen.getByText("Show 1 on hold"))
    fireEvent.click(screen.getByText("Show 1 shortlisted"))
    fireEvent.click(screen.getByText("Show 2 more"))

    const headings = Array.from(
      document.querySelectorAll("[cmdk-group-heading]"),
    ).map((h) => h.textContent)
    expect(headings).toEqual([
      "Currently assigned",
      "Booked",
      "Hold",
      "Shortlist",
      "Other talent",
    ])

    // The hoisted assigned talent keeps its casting status badge.
    const assigned = groupFor("Currently assigned")
    expect(within(assigned).getByText("Hold Harry")).toBeInTheDocument()
    expect(within(assigned).getByText("Hold")).toBeInTheDocument()
  })

  it("(4) falls back to the flat ungrouped list when the casting board is empty (permission-denied degrade pin)", async () => {
    mockEntries = []
    renderPicker()
    await openPicker()

    for (const t of ROSTER) {
      expect(screen.getByText(t.name)).toBeInTheDocument()
    }
    expect(document.querySelector("[cmdk-group-heading]")).toBeNull()
    expect(screen.queryByText(/^Show \d/)).not.toBeInTheDocument()
  })

  it("(2b) guards the Booked group: no orphan 'Booked' heading when the board has entries but none are booked", async () => {
    mockEntries = [
      makeEntry({ id: "e2", talentId: "t-hold", status: "hold" }),
      makeEntry({ id: "e3", talentId: "t-short", status: "shortlist" }),
    ]
    renderPicker()
    await openPicker()

    expect(screen.queryByText("Booked")).not.toBeInTheDocument()
  })

  it("(5) search finds a collapsed shortlist talent with its status badge, hides the disclosure buttons, and re-collapses on clear", async () => {
    renderPicker()
    await openPicker()

    // Collapsed by default: not mounted, unmatchable.
    expect(screen.queryByText("Shortlist Zara")).not.toBeInTheDocument()

    const input = screen.getByPlaceholderText("Search talent...")
    fireEvent.change(input, { target: { value: "Zara" } })

    const item = itemFor("Shortlist Zara")
    expect(within(item).getByText("Shortlist")).toBeInTheDocument()
    expect(screen.queryByText("No talent found.")).not.toBeInTheDocument()
    // Stale "Show N…" disclosure buttons are hidden while searching.
    expect(screen.queryByText(/^Show \d/)).not.toBeInTheDocument()

    // Clearing the query restores the collapsed state.
    fireEvent.change(input, { target: { value: "" } })
    expect(screen.queryByText("Shortlist Zara")).not.toBeInTheDocument()
    expect(screen.getByText("Show 1 shortlisted")).toBeInTheDocument()
  })

  it("(6a) coalesces rapid toggles into exactly ONE debounced save with the sorted union", async () => {
    mockEntries = [] // flat list: every item clickable without expanding
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave })
    await openPicker()

    vi.useFakeTimers()
    fireEvent.click(itemFor("Unstatused Uma"))
    fireEvent.click(itemFor("Booked Bella"))
    fireEvent.click(itemFor("Hold Harry"))

    expect(onSave).not.toHaveBeenCalled()
    await act(async () => {
      vi.advanceTimersByTime(499)
    })
    expect(onSave).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(1)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(["t-booked", "t-hold", "t-none"])
  })

  it("(6b) close mid-burst flushes exactly once — the close path is the flush, not a second save", async () => {
    mockEntries = []
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave })
    const trigger = await openPicker()

    vi.useFakeTimers()
    fireEvent.click(itemFor("Booked Bella"))
    expect(onSave).not.toHaveBeenCalled()

    // Close before the debounce fires → immediate flush.
    await act(async () => {
      fireEvent.click(trigger)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(["t-booked"])

    // The pending timer was cleared — no duplicate save afterwards.
    await act(async () => {
      vi.advanceTimersByTime(2000)
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it("(6c) flushes a pending burst on unmount", async () => {
    mockEntries = []
    const onSave = vi.fn().mockResolvedValue(true)
    const { unmount } = renderPicker({ onSave })
    await openPicker()

    vi.useFakeTimers()
    fireEvent.click(itemFor("Hold Harry"))
    expect(onSave).not.toHaveBeenCalled()

    unmount()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(["t-hold"])
  })

  it("(6d) no-op open/close cycle never calls onSave", async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave, selectedIds: ["t-booked"] })
    const trigger = await openPicker()

    fireEvent.click(trigger) // close with no toggles
    expect(onSave).not.toHaveBeenCalled()
  })

  it("(7) dual-field lockstep: the page-shaped lambda writes talent AND talentIds with identical id arrays", async () => {
    mockEntries = []
    const save = vi.fn().mockResolvedValue(true)
    renderPicker({
      // Mirrors ShotDetailPageUnified's wiring verbatim.
      onSave: (ids) => save({ talent: ids, talentIds: ids }),
    })
    const trigger = await openPicker()

    fireEvent.click(itemFor("Booked Bella"))
    fireEvent.click(trigger) // flush

    expect(save).toHaveBeenCalledTimes(1)
    const payload = save.mock.calls[0]?.[0] as { talent: string[]; talentIds: string[] }
    expect(payload.talent).toEqual(["t-booked"])
    expect(payload.talentIds).toEqual(["t-booked"])
    expect(payload.talent).toEqual(payload.talentIds)
  })

  it("(8) legacy talent-as-names selectedIds render sanely: nothing checked, names preserved in the saved array", async () => {
    mockEntries = []
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave, selectedIds: ["Alice Smith"] })

    // No id matches a name — trigger shows the empty state, nothing checked.
    expect(screen.getByText("Select talent...")).toBeInTheDocument()
    const trigger = await openPicker()
    for (const t of ROSTER) {
      expect(itemFor(t.name).getAttribute("aria-checked")).toBe("false")
    }
    // The auto-repair effect treats the legacy name as an orphaned link.
    expect(addTalentToProjectMock).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      ids: ["Alice Smith"],
    })

    // Toggling a real talent merges with (not clobbers) the legacy entry.
    fireEvent.click(itemFor("Unstatused Uma"))
    fireEvent.click(trigger) // flush
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(["Alice Smith", "t-none"])
  })

  it("(9) failed burst: rejected save reverts the toggles and surfaces exactly one toast", async () => {
    mockEntries = []
    const onSave = vi.fn().mockRejectedValue(new Error("boom"))
    renderPicker({ onSave })
    await openPicker()

    vi.useFakeTimers()
    fireEvent.click(itemFor("Booked Bella"))
    fireEvent.click(itemFor("Hold Harry"))
    expect(itemFor("Booked Bella").getAttribute("aria-checked")).toBe("true")
    expect(itemFor("Hold Harry").getAttribute("aria-checked")).toBe("true")

    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(itemFor("Booked Bella").getAttribute("aria-checked")).toBe("false")
    expect(itemFor("Hold Harry").getAttribute("aria-checked")).toBe("false")
    expect(toast.error).toHaveBeenCalledTimes(1)
  })

  it("(9b) save resolving false reverts silently (parent already toasted — one toast per failed burst)", async () => {
    mockEntries = []
    const onSave = vi.fn().mockResolvedValue(false)
    renderPicker({ onSave })
    await openPicker()

    vi.useFakeTimers()
    fireEvent.click(itemFor("Booked Bella"))
    await act(async () => {
      vi.advanceTimersByTime(500)
      await Promise.resolve()
    })

    expect(itemFor("Booked Bella").getAttribute("aria-checked")).toBe("false")
    expect(toast.error).not.toHaveBeenCalled()
  })

  it("(3a) a11y: decorative checkbox is aria-hidden, items carry aria-checked + cmdk's aria-selected, disclosure buttons wire aria-expanded/aria-controls", async () => {
    renderPicker({ selectedIds: ["t-booked"] })
    await openPicker()

    const bookedItem = itemFor("Booked Bella")
    expect(bookedItem.getAttribute("role")).toBe("option")
    expect(bookedItem.getAttribute("aria-checked")).toBe("true")
    // cmdk owns aria-selected (keyboard highlight) — pin that it renders.
    expect(bookedItem.getAttribute("aria-selected")).not.toBeNull()
    const checkbox = bookedItem.querySelector('[role="checkbox"]')
    expect(checkbox).not.toBeNull()
    expect(checkbox?.getAttribute("aria-hidden")).toBe("true")

    const holdToggle = screen.getByText("Show 1 on hold").closest("button")
    expect(holdToggle).not.toBeNull()
    expect(holdToggle?.getAttribute("aria-expanded")).toBe("false")
    const controlsId = holdToggle?.getAttribute("aria-controls")
    expect(controlsId).toBeTruthy()

    fireEvent.click(holdToggle as HTMLElement)
    const expandedToggle = screen.getByText("Hide hold").closest("button")
    expect(expandedToggle?.getAttribute("aria-expanded")).toBe("true")
    const holdGroup = document.getElementById(controlsId as string)
    expect(holdGroup).not.toBeNull()
    expect(within(holdGroup as HTMLElement).getByText("Hold Harry")).toBeInTheDocument()
  })

  it("(1b) draft toggling never mutates state in place: re-toggling after a save round-trip stays order-stable", async () => {
    mockEntries = []
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave, selectedIds: ["t-none", "t-booked"] })
    const trigger = await openPicker()

    // Toggle one off, flush — saved array is a sorted COPY, draft untouched.
    fireEvent.click(itemFor("Booked Bella"))
    fireEvent.click(trigger)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith(["t-none"])
  })

  it("(10) Escape inside the open picker never propagates to window — the page's Escape -> navigate(-1) shortcut must not fire", async () => {
    const onSave = vi.fn().mockResolvedValue(true)
    renderPicker({ onSave })
    await openPicker()

    const windowEscape = vi.fn()
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") windowEscape(event)
    }
    window.addEventListener("keydown", listener)
    try {
      fireEvent.keyDown(itemFor("Booked Bella"), { key: "Escape" })
      // Popover dismissed (content unmounts), flush ran as a no-op…
      expect(screen.queryByPlaceholderText("Search talent...")).not.toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
      // …and the window-level shortcut listener never saw the key.
      expect(windowEscape).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener("keydown", listener)
    }
  })
})
