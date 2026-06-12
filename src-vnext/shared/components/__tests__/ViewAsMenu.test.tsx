/// <reference types="@testing-library/jest-dom" />
// 5e-III — the QUIET "View as" trigger menu. Gated on featureShootSurface AND
// the GLOBAL admin/producer claim. Drives the in-memory ViewAsPreviewProvider
// ONLY — these tests assert it calls setPreviewRole("crew") / clearPreview and
// renders nothing for a viewer or when the flag is off.
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const authState = vi.hoisted(() => ({ role: "admin" }))
const flagState = vi.hoisted(() => ({ featureShootSurface: true }))
const previewState = vi.hoisted(() => ({
  previewRole: null as string | null,
  setPreviewRole: vi.fn(),
  clearPreview: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: authState.role }),
}))

vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "featureShootSurface" ? flagState.featureShootSurface : false,
}))

vi.mock("@/app/providers/ViewAsPreviewProvider", () => ({
  useViewAsPreview: () => ({
    previewRole: previewState.previewRole,
    setPreviewRole: previewState.setPreviewRole,
    clearPreview: previewState.clearPreview,
  }),
}))

import { ViewAsMenu } from "@/shared/components/ViewAsMenu"

describe("ViewAsMenu", () => {
  beforeEach(() => {
    authState.role = "admin"
    flagState.featureShootSurface = true
    previewState.previewRole = null
    previewState.setPreviewRole.mockReset()
    previewState.clearPreview.mockReset()
  })

  it("renders nothing for a viewer (non-global claim)", () => {
    authState.role = "viewer"
    render(<ViewAsMenu />)
    expect(screen.queryByTestId("view-as-trigger")).not.toBeInTheDocument()
  })

  it("renders nothing for crew (non-global claim)", () => {
    authState.role = "crew"
    render(<ViewAsMenu />)
    expect(screen.queryByTestId("view-as-trigger")).not.toBeInTheDocument()
  })

  it("renders nothing for warehouse (non-global claim)", () => {
    authState.role = "warehouse"
    render(<ViewAsMenu />)
    expect(screen.queryByTestId("view-as-trigger")).not.toBeInTheDocument()
  })

  it("renders nothing when the featureShootSurface flag is off", () => {
    flagState.featureShootSurface = false
    render(<ViewAsMenu />)
    expect(screen.queryByTestId("view-as-trigger")).not.toBeInTheDocument()
  })

  it("renders the trigger for a global admin with the flag on", () => {
    render(<ViewAsMenu />)
    expect(screen.getByTestId("view-as-trigger")).toBeInTheDocument()
    expect(screen.getByTestId("view-as-trigger")).toHaveTextContent("View as")
  })

  it("renders the trigger for a global producer with the flag on", () => {
    authState.role = "producer"
    render(<ViewAsMenu />)
    expect(screen.getByTestId("view-as-trigger")).toBeInTheDocument()
  })

  it("calls setPreviewRole('crew') when the Crew (Shoot) item is chosen", async () => {
    const user = userEvent.setup()
    render(<ViewAsMenu />)
    await user.click(screen.getByTestId("view-as-trigger"))
    await user.click(await screen.findByTestId("view-as-crew"))
    expect(previewState.setPreviewRole).toHaveBeenCalledTimes(1)
    expect(previewState.setPreviewRole).toHaveBeenCalledWith("crew")
    expect(previewState.clearPreview).not.toHaveBeenCalled()
  })

  it("shows 'Previewing as Crew' and an enabled return item while previewing, and clears on select", async () => {
    previewState.previewRole = "crew"
    const user = userEvent.setup()
    render(<ViewAsMenu />)
    const trigger = screen.getByTestId("view-as-trigger")
    expect(trigger).toHaveTextContent("Previewing as Crew")
    await user.click(trigger)
    const returnItem = await screen.findByTestId("view-as-return")
    expect(returnItem).not.toHaveAttribute("aria-disabled", "true")
    await user.click(returnItem)
    expect(previewState.clearPreview).toHaveBeenCalledTimes(1)
    expect(previewState.setPreviewRole).not.toHaveBeenCalled()
  })

  it("disables the return item when NOT previewing", async () => {
    const user = userEvent.setup()
    render(<ViewAsMenu />)
    await user.click(screen.getByTestId("view-as-trigger"))
    const returnItem = await screen.findByTestId("view-as-return")
    expect(returnItem).toHaveAttribute("aria-disabled", "true")
  })
})
