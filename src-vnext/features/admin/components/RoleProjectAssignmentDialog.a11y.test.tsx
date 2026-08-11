/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

/**
 * Focused a11y regression guard for RoleProjectAssignmentDialog.
 *
 * AdminPage.a11y.test.tsx mocks UserRoleSelect away entirely
 * (`vi.mock("./UserRoleSelect", ...)`), so this dialog — which only mounts
 * from inside UserRoleSelect or UserDetailPanel's reactivate handler — is
 * invisible to that page-level a11y coverage. This file exercises the real
 * component directly, mirroring the house pattern set by
 * ProductListPage.a11y.test.tsx (button-name) and AdminPage.a11y.test.tsx
 * (color-contrast): axe-core/jest-axe are not installed, so these are
 * hand-written checks for the same rules axe would flag, not a live axe run.
 * The Playwright a11y spec (tests/a11y.spec.ts) is currently scoped to
 * `color-contrast` only and does not open this dialog at all.
 */

// ---- Mocks (same shape as RoleProjectAssignmentDialog.test.tsx) ----

const mockBulkAddProjectMembers = vi.fn()

vi.mock("@/features/admin/lib/adminWrites", () => ({
  bulkAddProjectMembers: (...args: unknown[]) => mockBulkAddProjectMembers(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

const memberDocState = vi.hoisted(() => ({
  existingMemberDocIds: new Set<string>(),
}))

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ __pathArgs: args }),
  getDoc: async (ref: { __pathArgs: unknown[] }) => {
    const projectId = ref.__pathArgs[ref.__pathArgs.length - 3] as string
    return { exists: () => memberDocState.existingMemberDocIds.has(projectId) }
  },
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [{ id: "p1", name: "Project One" }],
    loading: false,
    error: null,
  }),
}))

import { RoleProjectAssignmentDialog } from "./RoleProjectAssignmentDialog"

/**
 * Minimal implementation of the WAI-ARIA accessible-name algorithm sufficient
 * for axe-core's `button-name` check — see ProductListPage.a11y.test.tsx for
 * the canonical version this mirrors.
 */
function getAccessibleName(el: Element): string {
  const labelledBy = el.getAttribute("aria-labelledby")
  if (labelledBy) {
    const doc = el.ownerDocument
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
    if (parts.length > 0) return parts.join(" ")
  }

  const ariaLabel = el.getAttribute("aria-label")
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim()

  const text = (el.textContent ?? "").trim()
  if (text) return text

  return ""
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof RoleProjectAssignmentDialog>> = {}) {
  const defaults = {
    open: true,
    onOpenChange: vi.fn(),
    userId: "u1",
    userEmail: "crew@example.com",
    newRole: "crew" as const,
    clientId: "c1",
    addedBy: "admin-1",
  }
  return render(<RoleProjectAssignmentDialog {...defaults} {...overrides} />)
}

describe("RoleProjectAssignmentDialog a11y", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    memberDocState.existingMemberDocIds = new Set()
  })

  it("every button in the dialog has an accessible name (axe button-name equivalent)", async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByText(/can't see any projects yet/)).toBeInTheDocument()
    })

    // ResponsiveDialog renders via a Radix Portal into document.body, outside
    // RTL's `container` (the local mount root) — query the full document so
    // portal-rendered buttons (Skip / Assign, the ones that actually matter
    // here) aren't silently skipped.
    //
    // axe-core's `button-name` rule applies to elements whose COMPUTED role
    // is "button" — it does not cover Radix's checkbox trigger, which is a
    // `<button role="checkbox">` named via its associated `<label for>`
    // (a valid accname source for form controls, just not one this file's
    // button-name-only `getAccessibleName` checks). Excluding non-button
    // roles keeps this test aligned with the actual rule instead of
    // over-flagging a correctly-labelled control.
    const buttons = Array.from(document.body.querySelectorAll("button")).filter((btn) => {
      const role = btn.getAttribute("role")
      return role === null || role === "button"
    })
    expect(buttons.length).toBeGreaterThan(0)
    const offenders = buttons.filter((btn) => !getAccessibleName(btn))
    expect(offenders, offenders.map((b) => b.outerHTML).join("\n")).toHaveLength(0)
  })

  it("the zero-membership warning is exposed as a status region (role=\"status\") for assistive tech", async () => {
    renderDialog()
    await waitFor(() => {
      const status = screen.getByRole("status")
      expect(status).toHaveTextContent(/can't see any projects yet/)
    })
  })

  it("does not render a status region once the user has existing project access", async () => {
    memberDocState.existingMemberDocIds = new Set(["p1"])
    renderDialog()
    await waitFor(() => {
      // Existing-project-ids lookup has settled (picker's checkbox reflects it).
      expect(screen.getByLabelText(/project one/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })
})
