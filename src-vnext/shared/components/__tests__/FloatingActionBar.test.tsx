/// <reference types="@testing-library/jest-dom" />
// 5e-II eyeball finding: the FAB overlapped the Shoot shell's sticky bottom
// status bar. The shell owns its own create/status affordances, so the FAB
// suppresses itself when the resolved surface is 'shoot' under the flag.
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { FloatingActionBar } from "@/shared/components/FloatingActionBar"
import type { Role } from "@/shared/lib/rbac"

const mocks = vi.hoisted(() => ({
  isDesktop: false,
  isMobile: true,
  role: "producer" as Role,
  shootFlag: false,
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsDesktop: () => mocks.isDesktop,
  useIsMobile: () => mocks.isMobile,
}))

vi.mock("@/shared/hooks/useEffectiveRole", () => ({
  useEffectiveRole: () => ({ role: mocks.role, resolving: false }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ loading: false, role: mocks.role, user: { uid: "u1" } }),
}))

vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: string) =>
      flag === "featureShootSurface"
        ? mocks.shootFlag
        : actual.isFeatureEnabled(flag as never),
  }
})

function renderAtShotList() {
  return render(
    <MemoryRouter initialEntries={["/projects/p1/shots"]}>
      <FloatingActionBar />
    </MemoryRouter>,
  )
}

describe("FloatingActionBar — Shoot shell suppression", () => {
  beforeEach(() => {
    mocks.isDesktop = false
    mocks.isMobile = true
    mocks.role = "producer"
    mocks.shootFlag = false
  })

  it("renders on the mobile shot list with the flag off (today's behavior)", () => {
    renderAtShotList()
    expect(screen.getByTestId("fab")).toBeInTheDocument()
  })

  it("renders for plan-build users (producer) with the flag on", () => {
    mocks.shootFlag = true
    renderAtShotList()
    expect(screen.getByTestId("fab")).toBeInTheDocument()
  })

  it("suppresses itself on the Shoot surface (crew + flag on)", () => {
    mocks.shootFlag = true
    mocks.role = "crew"
    renderAtShotList()
    expect(screen.queryByTestId("fab")).not.toBeInTheDocument()
  })

  it("does NOT suppress for crew while the flag is off", () => {
    mocks.role = "crew"
    renderAtShotList()
    expect(screen.getByTestId("fab")).toBeInTheDocument()
  })
})
