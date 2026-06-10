/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { CastingBoardEntry } from "@/shared/types"

// 5b global-claim state, mutable so promotion rows can flip the global role.
const authState = vi.hoisted(() => ({ role: "producer" }))

// 5b effective-role state. role=null mirrors the global claim (member ==
// global / no project scope, the default matrix shape); a string overrides
// it (downgrade/promotion rows); resolving=true pins the first-read
// affordance gap.
const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: authState.role,
    clientId: "c1",
    user: { uid: "u1" },
    loading: false,
  }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role ?? authState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
  useOptionalProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => false,
}))

vi.mock("@/features/casting/hooks/useCastingBoard", () => ({
  useCastingBoard: vi.fn(),
}))

vi.mock("@/features/library/hooks/useTalentLibrary", () => ({
  useTalentLibrary: vi.fn(),
}))

vi.mock("@/features/casting/hooks/useCastingVoteAggregates", () => ({
  useCastingVoteAggregates: () => ({ aggregates: new Map() }),
}))

vi.mock("@/features/casting/lib/castingWrites", () => ({
  addTalentToCastingBoard: vi.fn(),
  updateCastingEntry: vi.fn(),
  bookCastingTalent: vi.fn(),
  removeTalentFromCastingBoard: vi.fn(),
  bulkUpdateCastingStatus: vi.fn(),
}))

vi.mock("@/features/casting/components/CastingCard", () => ({
  CastingCard: ({
    entry,
    canEdit,
    onBook,
  }: {
    readonly entry: CastingBoardEntry
    readonly canEdit: boolean
    readonly onBook: (talentId: string) => void
  }) => (
    <div data-testid="casting-card">
      {entry.talentName}
      {canEdit ? " (editable)" : ""}
      {canEdit && (
        <button type="button" onClick={() => onBook(entry.talentId)}>
          Book
        </button>
      )}
    </div>
  ),
}))

vi.mock("@/features/casting/components/AddCastingTalentDialog", () => ({
  AddCastingTalentDialog: () => null,
}))

vi.mock("@/features/casting/components/CastingShareDialog", () => ({
  CastingShareDialog: () => null,
}))

vi.mock("@/features/casting/components/AdminTalentDetailSheet", () => ({
  AdminTalentDetailSheet: () => null,
}))

import { useCastingBoard } from "@/features/casting/hooks/useCastingBoard"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { bookCastingTalent } from "@/features/casting/lib/castingWrites"
import CastingBoardPage from "@/features/casting/components/CastingBoardPage"

function makeEntry(overrides: Partial<CastingBoardEntry>): CastingBoardEntry {
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
  }
}

describe("CastingBoardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
    effectiveState.role = null
    effectiveState.resolving = false
    ;(useCastingBoard as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      entries: [makeEntry({})],
      loading: false,
      error: null,
    })
    ;(useTalentLibrary as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
  })

  it("renders edit + share affordances for a producer when the effective role mirrors the global claim (null-scope fallback shape)", () => {
    render(<CastingBoardPage />)

    expect(screen.getByRole("button", { name: /add talent/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    expect(screen.getByTestId("casting-card")).toHaveTextContent("Talent One (editable)")
    // No downgrade — chip stays hidden
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders no board-edit affordances while the effective role is resolving; the global-pinned Share stays", () => {
    effectiveState.resolving = true
    render(<CastingBoardPage />)

    expect(screen.queryByRole("button", { name: /add talent/i })).not.toBeInTheDocument()
    expect(screen.getByTestId("casting-card")).not.toHaveTextContent("(editable)")
    // Share is pinned to the GLOBAL claim (/castingShares create,
    // firestore.rules:227-231) and does not wait on the member read.
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    // Chip renders nothing while resolving
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("project downgrade: member-doc viewer beats the global producer claim for board edits; Share stays pinned and the chip shows", () => {
    effectiveState.role = "viewer"
    render(<CastingBoardPage />)

    expect(screen.queryByRole("button", { name: /add talent/i })).not.toBeInTheDocument()
    expect(screen.getByTestId("casting-card")).not.toHaveTextContent("(editable)")
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent("Viewer on this project")
  })

  it("project promotion: member-doc producer enables board edits for a global viewer, but Share stays pinned to the global claim", () => {
    authState.role = "viewer"
    effectiveState.role = "producer"
    render(<CastingBoardPage />)

    expect(screen.getByRole("button", { name: /add talent/i })).toBeInTheDocument()
    expect(screen.getByTestId("casting-card")).toHaveTextContent("Talent One (editable)")
    // /castingShares create requires a GLOBAL admin/producer claim — the
    // backend cannot see a project promotion.
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument()
    // Promotion is not a downgrade — chip stays hidden
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("promotion Book path: a project-promoted member books WITHOUT the talent-doc backlink (global-claim-only rule, firestore.rules:363-365)", () => {
    authState.role = "viewer"
    effectiveState.role = "producer"
    render(<CastingBoardPage />)

    fireEvent.click(screen.getByRole("button", { name: "Book" }))

    // The talent projectIds backlink is GLOBAL-claim only; the atomic batch
    // must skip it or the whole Book is permission-denied for this combo.
    expect(bookCastingTalent).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      userId: "u1",
      talentId: "t1",
      includeTalentBacklink: false,
    })
  })

  it("global-producer Book path: books WITH the talent-doc backlink", () => {
    render(<CastingBoardPage />)

    fireEvent.click(screen.getByRole("button", { name: "Book" }))

    expect(bookCastingTalent).toHaveBeenCalledWith({
      clientId: "c1",
      projectId: "p1",
      userId: "u1",
      talentId: "t1",
      includeTalentBacklink: true,
    })
  })

  it("shows the empty-state Add Talent action only when board edits are allowed", () => {
    ;(useCastingBoard as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      entries: [],
      loading: false,
      error: null,
    })
    effectiveState.role = "viewer"
    render(<CastingBoardPage />)

    expect(screen.getByText("No talent on the casting board")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /add talent/i })).not.toBeInTheDocument()
  })
})
