/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Pull } from "@/shared/types"

vi.mock("@/features/pulls/hooks/usePulls", () => ({
  usePulls: vi.fn(),
}))

// Mutable global claim so promotion rows can flip it (5b matrix shape).
const authState = vi.hoisted(() => ({ role: "producer" }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, clientId: "c1", loading: false }),
}))

// 5b effective-role state. role=null mirrors the global claim (member ==
// global, the default matrix shape); a string overrides it (downgrade rows);
// resolving=true pins the first-read affordance gap.
const effectiveState = vi.hoisted(() => ({
  role: null as string | null,
  resolving: false,
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

vi.mock("@/features/pulls/components/PullCard", () => ({
  PullCard: ({ pull }: { readonly pull: Pull }) => <div>pull:{pull.id}</div>,
}))

vi.mock("@/features/pulls/components/CreatePullDialog", () => ({
  CreatePullDialog: () => null,
}))

import { usePulls } from "@/features/pulls/hooks/usePulls"
import PullListPage from "@/features/pulls/components/PullListPage"

function makePull(overrides: Partial<Pull>): Pull {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "pull1",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    name: overrides.name ?? "Pull 1",
    shotIds: overrides.shotIds ?? [],
    items: overrides.items ?? [],
    status: overrides.status ?? "draft",
    shareEnabled: overrides.shareEnabled ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function setPulls(pulls: Pull[]) {
  ;(usePulls as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: pulls,
    loading: false,
    error: null,
  })
}

describe("PullListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
    effectiveState.role = null
    effectiveState.resolving = false
    setPulls([makePull({})])
  })

  it("shows the create affordance for a producer (effective role mirrors global)", () => {
    render(<PullListPage />)
    expect(screen.getByRole("button", { name: /new pull sheet/i })).toBeInTheDocument()
    // Equal roles: no downgrade chip.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders no write affordances while the effective role is resolving", () => {
    effectiveState.resolving = true
    render(<PullListPage />)
    expect(screen.queryByRole("button", { name: /new pull sheet/i })).not.toBeInTheDocument()
    // Chip is self-gating and also renders nothing while resolving.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("hides the create affordance on a per-project downgrade (member doc wins)", () => {
    effectiveState.role = "viewer"
    render(<PullListPage />)
    expect(screen.queryByRole("button", { name: /new pull sheet/i })).not.toBeInTheDocument()
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent("Viewer on this project")
  })

  it("shows the create affordance on a per-project promotion (member doc wins)", () => {
    authState.role = "viewer"
    effectiveState.role = "warehouse"
    render(<PullListPage />)
    expect(screen.getByRole("button", { name: /new pull sheet/i })).toBeInTheDocument()
    // Upgrades render no chip.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("falls back to the global claim when there is no member-doc override (null-scope shape)", () => {
    // useEffectiveRole returns the global claim when no ProjectScopeProvider
    // / member doc exists (hook-level behavior, unit-tested in
    // useEffectiveRole.test.tsx). role=null mirrors that fallback here.
    authState.role = "viewer"
    effectiveState.role = null
    render(<PullListPage />)
    expect(screen.queryByRole("button", { name: /new pull sheet/i })).not.toBeInTheDocument()
  })

  it("hides the empty-state create action for read-only effective roles", () => {
    effectiveState.role = "viewer"
    setPulls([])
    render(<PullListPage />)
    expect(screen.getByText("No pull sheets yet")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /create pull sheet/i })).not.toBeInTheDocument()
  })
})
