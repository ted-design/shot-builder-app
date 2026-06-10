/// <reference types="@testing-library/jest-dom" />
// Phase 5b — quiet role chip: visible ONLY when effectiveRole < globalRole.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const authState = vi.hoisted(() => ({ role: "producer", loading: false }))
const effectiveState = vi.hoisted(() => ({ role: "producer", resolving: false }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, loading: authState.loading }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role,
    resolving: effectiveState.resolving,
  }),
}))

import { EffectiveRoleChip } from "@/shared/components/EffectiveRoleChip"

describe("EffectiveRoleChip", () => {
  beforeEach(() => {
    authState.role = "producer"
    authState.loading = false
    effectiveState.role = "producer"
    effectiveState.resolving = false
  })

  it("is hidden when the effective role equals the global role", () => {
    render(<EffectiveRoleChip />)
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("shows the downgrade copy when the effective role is lower (producer→viewer)", () => {
    effectiveState.role = "viewer"
    render(<EffectiveRoleChip />)
    const chip = screen.getByTestId("effective-role-chip")
    expect(chip).toHaveTextContent("Viewer on this project")
  })

  it("shows the lateral-rank crew downgrade for a global producer (the live xana shape)", () => {
    effectiveState.role = "crew"
    render(<EffectiveRoleChip />)
    expect(screen.getByTestId("effective-role-chip")).toHaveTextContent(
      "Crew on this project",
    )
  })

  it("is hidden on an effective UPGRADE (crew global, producer member doc)", () => {
    authState.role = "crew"
    effectiveState.role = "producer"
    render(<EffectiveRoleChip />)
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })

  it("renders nothing while the effective role is resolving or auth is loading", () => {
    effectiveState.role = "viewer"
    effectiveState.resolving = true
    const { rerender } = render(<EffectiveRoleChip />)
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()

    effectiveState.resolving = false
    authState.loading = true
    rerender(<EffectiveRoleChip />)
    expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
  })
})
