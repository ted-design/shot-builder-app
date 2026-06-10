/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import type { ProductFamily, ProductVersion } from "@/shared/types"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const deviceState = vi.hoisted(() => ({ isMobile: false }))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => deviceState.isMobile,
}))

// PIN test harness: the section must consume useAuth's GLOBAL role — the
// productFamilies update rule (firestore.rules:568) is isAdmin() ||
// isProducer(), no project arm. authState drives the global claim;
// effectiveState exists ONLY to prove a project promotion is ignored.
const authState = vi.hoisted(() => ({ role: "producer" }))
const effectiveState = vi.hoisted(() => ({ role: "producer", resolving: false }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: authState.role,
    user: {
      uid: "u1",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      photoURL: null,
    },
  }),
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({
    role: effectiveState.role,
    resolving: effectiveState.resolving,
  }),
}))

vi.mock("@/features/products/hooks/useProductVersions", () => ({
  useProductVersions: vi.fn(),
}))

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductSkus: () => ({ data: [], loading: false, error: null }),
}))

vi.mock("@/features/products/lib/productVersioning", () => ({
  restoreProductVersion: vi.fn(),
}))

import { useProductVersions } from "@/features/products/hooks/useProductVersions"
import { ProductVersionHistorySection } from "@/features/products/components/ProductVersionHistorySection"

function makeFamily(overrides: Partial<ProductFamily> = {}): ProductFamily {
  return {
    id: overrides.id ?? "f1",
    styleName: overrides.styleName ?? "Test Family",
    ...overrides,
  }
}

function makeVersion(overrides: Partial<ProductVersion> = {}): ProductVersion {
  return {
    id: overrides.id ?? "v1",
    snapshot: overrides.snapshot ?? { styleName: "Old name" },
    createdAt: overrides.createdAt ?? Timestamp.fromMillis(Date.now()),
    createdBy: overrides.createdBy ?? "u1",
    createdByName: overrides.createdByName ?? "Alex Rivera",
    createdByAvatar: overrides.createdByAvatar ?? null,
    changeType: overrides.changeType ?? "update",
    changedFields: overrides.changedFields ?? ["styleName"],
  }
}

function mockVersions(versions: ProductVersion[]) {
  ;(useProductVersions as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
    data: versions,
    loading: false,
    error: null,
  })
}

describe("ProductVersionHistorySection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deviceState.isMobile = false
    authState.role = "producer"
    effectiveState.role = "producer"
    effectiveState.resolving = false
  })

  it("shows Restore for a global producer on a non-create version", async () => {
    const user = userEvent.setup()
    mockVersions([makeVersion({ id: "v-1" })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument()
  })

  it("hides Restore for global crew and shows the read-only hint", async () => {
    const user = userEvent.setup()
    authState.role = "crew"
    effectiveState.role = "crew"
    mockVersions([makeVersion({ id: "v-1" })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument()
    expect(
      screen.getByText("Restore is producer/admin desktop-only."),
    ).toBeInTheDocument()
  })

  it("hides Restore for a global viewer", async () => {
    const user = userEvent.setup()
    authState.role = "viewer"
    effectiveState.role = "viewer"
    mockVersions([makeVersion({ id: "v-1" })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument()
  })

  it("stays PINNED to the global claim: a project-promoted crew gets no Restore", async () => {
    const user = userEvent.setup()
    authState.role = "crew"
    // Effective role says producer (project promotion) — the rule at
    // firestore.rules:568 cannot see it, so the UI must not advertise Restore.
    effectiveState.role = "producer"
    mockVersions([makeVersion({ id: "v-1" })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument()
  })

  it("hides Restore on mobile even for a producer", async () => {
    const user = userEvent.setup()
    deviceState.isMobile = true
    mockVersions([makeVersion({ id: "v-1" })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument()
  })

  it("never offers Restore on the create version", async () => {
    const user = userEvent.setup()
    mockVersions([makeVersion({ id: "v-1", changeType: "create", changedFields: [] })])

    render(<ProductVersionHistorySection family={makeFamily()} />)
    await user.click(screen.getByRole("button", { name: /version history/i }))

    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument()
  })
})
