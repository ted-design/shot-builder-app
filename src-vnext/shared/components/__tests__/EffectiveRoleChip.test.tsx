/// <reference types="@testing-library/jest-dom" />
// Phase 5b — quiet role chip: visible ONLY when effectiveRole < globalRole.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

const authState = vi.hoisted(() => ({ role: "producer", loading: false }))
const effectiveState = vi.hoisted(() => ({ role: "producer", resolving: false }))
// 5e-III: View-as preview. Default previewRole null = not previewing, so the
// existing downgrade/no-render pins below stay unchanged.
const previewState = vi.hoisted(() => ({ previewRole: null as string | null }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role, loading: authState.loading }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/app/providers/ViewAsPreviewProvider", () => ({
  useViewAsPreview: () => ({
    previewRole: previewState.previewRole,
    setPreviewRole: () => {},
    clearPreview: () => {},
  }),
}))

import { EffectiveRoleChip } from "@/shared/components/EffectiveRoleChip"

describe("EffectiveRoleChip", () => {
  beforeEach(() => {
    authState.role = "producer"
    authState.loading = false
    effectiveState.role = "producer"
    effectiveState.resolving = false
    previewState.previewRole = null
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

  // 5e-III View-as preview — a DISTINCT chip that takes precedence over and is
  // independent of the downgrade condition.
  describe("5e-III View-as preview", () => {
    it("renders the distinct 'Previewing as Crew' chip when previewRole is crew", () => {
      previewState.previewRole = "crew"
      render(<EffectiveRoleChip />)
      const chip = screen.getByTestId("view-as-previewing-chip")
      expect(chip).toHaveTextContent("Previewing as Crew")
      // The downgrade pill must NOT also render.
      expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
    })

    it("renders the preview chip even when there is NO real downgrade (effective === global)", () => {
      // Producer global AND producer effective => no downgrade pill would show,
      // but the preview chip still renders because it branches on previewRole.
      authState.role = "producer"
      effectiveState.role = "producer"
      previewState.previewRole = "crew"
      render(<EffectiveRoleChip />)
      expect(screen.getByTestId("view-as-previewing-chip")).toHaveTextContent(
        "Previewing as Crew",
      )
    })

    it("preview chip takes precedence even while the effective role is resolving", () => {
      // previewRole branches BEFORE the resolving/loading guards.
      effectiveState.resolving = true
      previewState.previewRole = "crew"
      render(<EffectiveRoleChip />)
      expect(
        screen.getByTestId("view-as-previewing-chip"),
      ).toBeInTheDocument()
    })

    it("previewRole null keeps the existing downgrade behavior (no preview chip)", () => {
      previewState.previewRole = null
      effectiveState.role = "viewer"
      render(<EffectiveRoleChip />)
      expect(
        screen.queryByTestId("view-as-previewing-chip"),
      ).not.toBeInTheDocument()
      expect(screen.getByTestId("effective-role-chip")).toHaveTextContent(
        "Viewer on this project",
      )
    })

    it("previewRole null with no downgrade renders nothing at all", () => {
      previewState.previewRole = null
      effectiveState.role = "producer"
      render(<EffectiveRoleChip />)
      expect(
        screen.queryByTestId("view-as-previewing-chip"),
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId("effective-role-chip")).not.toBeInTheDocument()
    })
  })
})
