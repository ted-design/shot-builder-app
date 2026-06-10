/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { FulfillmentFirestoreStatus, Pull, PullItem } from "@/shared/types"

vi.mock("@/features/pulls/hooks/usePull", () => ({
  usePull: vi.fn(),
}))

vi.mock("@/features/pulls/lib/updatePull", () => ({
  updatePullField: vi.fn(),
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

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
}))

vi.mock("@/features/pulls/components/FulfillmentToggle", () => ({
  FulfillmentToggle: ({ disabled }: { readonly disabled: boolean }) => (
    <button data-testid="fulfillment-toggle" disabled={disabled}>
      toggle
    </button>
  ),
}))

import { usePull } from "@/features/pulls/hooks/usePull"
import PullDetailPage from "@/features/pulls/components/PullDetailPage"

function makeItem(overrides: Partial<PullItem>): PullItem {
  return {
    familyId: overrides.familyId ?? "f1",
    familyName: overrides.familyName ?? "Family 1",
    sizes: overrides.sizes ?? [],
    fulfillmentStatus:
      overrides.fulfillmentStatus ?? ("pending" as FulfillmentFirestoreStatus),
  }
}

function makePull(overrides: Partial<Pull>): Pull {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "pull1",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    name: overrides.name ?? "Pull 1",
    shotIds: overrides.shotIds ?? [],
    items: overrides.items ?? [makeItem({})],
    status: overrides.status ?? "draft",
    shareEnabled: overrides.shareEnabled ?? false,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function setPull(pull: Pull | null) {
  ;(usePull as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: pull,
    loading: false,
    error: null,
  })
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/pulls/pull1"]}>
      <Routes>
        <Route path="/projects/:id/pulls/:pid" element={<PullDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("PullDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = "producer"
    effectiveState.role = null
    effectiveState.resolving = false
    setPull(makePull({}))
  })

  it("shows edit affordances for a producer (effective role mirrors global)", () => {
    renderPage()
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeEnabled()
    // Producer is not a fulfiller (canFulfillPulls = admin || warehouse).
    expect(screen.getByTestId("fulfillment-toggle")).toBeDisabled()
    // Equal roles: no downgrade chip.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders no write affordances while the effective role is resolving", () => {
    effectiveState.resolving = true
    renderPage()
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
    expect(screen.getByTestId("fulfillment-toggle")).toBeDisabled()
    // Title falls back to the read-only heading, not the inline editor.
    expect(screen.getByRole("heading", { name: "Pull 1" })).toBeInTheDocument()
    // Chip is self-gating and also renders nothing while resolving.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("hides edit affordances on a per-project downgrade (member doc wins)", () => {
    effectiveState.role = "viewer"
    renderPage()
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
    expect(screen.getByTestId("fulfillment-toggle")).toBeDisabled()
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent("Viewer on this project")
  })

  it("enables fulfillment for a warehouse member doc over a producer claim", () => {
    effectiveState.role = "warehouse"
    renderPage()
    // Warehouse can manage AND fulfill pulls.
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    expect(screen.getByTestId("fulfillment-toggle")).toBeEnabled()
    // Warehouse ranks below producer, so the downgrade chip shows.
    expect(screen.getByTestId("effective-role-chip")).toBeInTheDocument()
  })

  it("shows edit affordances on a per-project promotion (member doc wins)", () => {
    authState.role = "viewer"
    effectiveState.role = "producer"
    renderPage()
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeEnabled()
    // Upgrades render no chip.
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("falls back to the global claim when there is no member-doc override (null-scope shape)", () => {
    // useEffectiveRole returns the global claim when no ProjectScopeProvider
    // / member doc exists (hook-level behavior, unit-tested in
    // useEffectiveRole.test.tsx). role=null mirrors that fallback here.
    authState.role = "viewer"
    effectiveState.role = null
    renderPage()
    expect(screen.queryByRole("button", { name: /share/i })).not.toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeDisabled()
  })
})
