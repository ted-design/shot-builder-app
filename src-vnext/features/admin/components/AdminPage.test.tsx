/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import type { UserProfile } from "@/shared/types"

// ---- Mocks ----

vi.mock("@/features/admin/hooks/useUsers", () => ({
  useUsers: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

// Stub sub-components to isolate AdminPage rendering
vi.mock("@/features/admin/components/InviteUserDialog", () => ({
  InviteUserDialog: ({ open }: { readonly open: boolean }) =>
    open ? <div data-testid="invite-dialog">InviteDialog</div> : null,
}))

vi.mock("@/features/admin/components/ProjectAccessTab", () => ({
  ProjectAccessTab: () => <div data-testid="project-access-tab">ProjectAccessTab</div>,
}))

vi.mock("@/features/admin/components/UserRoleSelect", () => ({
  UserRoleSelect: ({
    userEmail,
    currentRole,
    disabled,
  }: {
    readonly userEmail: string
    readonly currentRole: string
    readonly disabled?: boolean
  }) => (
    <div data-testid="role-select" data-email={userEmail} data-disabled={disabled ? "true" : "false"}>
      {currentRole}
    </div>
  ),
}))

import { useUsers } from "@/features/admin/hooks/useUsers"
import { useAuth } from "@/app/providers/AuthProvider"
import AdminPage from "./AdminPage"

const mockUseUsers = useUsers as unknown as { mockReturnValue: (v: unknown) => void }
const mockUseAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }

function makeUser(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "u1",
    email: "user@example.com",
    displayName: "Test User",
    role: "producer",
    updatedAt: Timestamp.fromMillis(Date.now()),
    ...overrides,
  }
}

function renderPage() {
  return render(<AdminPage />)
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseAuth.mockReturnValue({ user: { uid: "admin-uid" }, clientId: "c1" })
  })

  describe("loading state", () => {
    it("renders skeleton while loading", () => {
      mockUseUsers.mockReturnValue({ data: [], loading: true, error: null })
      renderPage()
      // LoadingState with skeleton renders — page header should not be visible yet
      expect(screen.queryByText("Team")).not.toBeInTheDocument()
    })
  })

  describe("error state", () => {
    it("renders error message when useUsers returns an error", () => {
      mockUseUsers.mockReturnValue({
        data: [],
        loading: false,
        error: { message: "Firestore connection failed", isMissingIndex: false },
      })
      renderPage()
      expect(screen.getByText("Firestore connection failed")).toBeInTheDocument()
    })
  })

  describe("empty state", () => {
    it("renders empty state when no users exist", () => {
      mockUseUsers.mockReturnValue({ data: [], loading: false, error: null })
      renderPage()
      expect(screen.getByText("No team members yet")).toBeInTheDocument()
      expect(screen.getByText(/invite team members/i)).toBeInTheDocument()
    })

    it("renders Invite User button in empty state", () => {
      mockUseUsers.mockReturnValue({ data: [], loading: false, error: null })
      renderPage()
      // There are two Invite User buttons: PageHeader action and EmptyState CTA
      const buttons = screen.getAllByRole("button", { name: /invite user/i })
      expect(buttons.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe("populated state", () => {
    it("renders a row for each user", () => {
      mockUseUsers.mockReturnValue({
        data: [
          makeUser({ id: "u1", email: "alice@example.com", displayName: "Alice" }),
          makeUser({ id: "u2", email: "bob@example.com", displayName: "Bob" }),
        ],
        loading: false,
        error: null,
      })
      renderPage()
      expect(screen.getByText("alice@example.com")).toBeInTheDocument()
      expect(screen.getByText("bob@example.com")).toBeInTheDocument()
      expect(screen.getByText("Alice")).toBeInTheDocument()
      expect(screen.getByText("Bob")).toBeInTheDocument()
    })

    it("renders em-dash when displayName is null", () => {
      mockUseUsers.mockReturnValue({
        data: [makeUser({ displayName: null })],
        loading: false,
        error: null,
      })
      renderPage()
      expect(screen.getByText("—")).toBeInTheDocument()
    })

    it("renders UserRoleSelect for each user when clientId is present", () => {
      mockUseUsers.mockReturnValue({
        data: [
          makeUser({ id: "u1", email: "alice@example.com" }),
          makeUser({ id: "u2", email: "bob@example.com" }),
        ],
        loading: false,
        error: null,
      })
      renderPage()
      const roleSelects = screen.getAllByTestId("role-select")
      expect(roleSelects).toHaveLength(2)
    })

    it("renders role label instead of select when clientId is null", () => {
      mockUseAuth.mockReturnValue({ user: { uid: "admin-uid" }, clientId: null })
      mockUseUsers.mockReturnValue({
        data: [makeUser({ role: "producer" })],
        loading: false,
        error: null,
      })
      renderPage()
      expect(screen.queryByTestId("role-select")).not.toBeInTheDocument()
      expect(screen.getByText("Producer")).toBeInTheDocument()
    })

    it("disables UserRoleSelect for the currently signed-in user", () => {
      mockUseAuth.mockReturnValue({ user: { uid: "u1" }, clientId: "c1" })
      mockUseUsers.mockReturnValue({
        data: [
          makeUser({ id: "u1", email: "self@example.com" }),
          makeUser({ id: "u2", email: "other@example.com" }),
        ],
        loading: false,
        error: null,
      })
      renderPage()
      const selects = screen.getAllByTestId("role-select")
      const selfSelect = selects.find((s) => s.dataset.email === "self@example.com")
      const otherSelect = selects.find((s) => s.dataset.email === "other@example.com")
      expect(selfSelect?.dataset.disabled).toBe("true")
      expect(otherSelect?.dataset.disabled).toBe("false")
    })

    it("renders table headers", () => {
      mockUseUsers.mockReturnValue({
        data: [makeUser()],
        loading: false,
        error: null,
      })
      renderPage()
      expect(screen.getByText("Name")).toBeInTheDocument()
      expect(screen.getByText("Email")).toBeInTheDocument()
      expect(screen.getByText("Role")).toBeInTheDocument()
      expect(screen.getByText("Updated")).toBeInTheDocument()
    })
  })

  describe("invite dialog", () => {
    it("invite dialog is closed by default", () => {
      mockUseUsers.mockReturnValue({ data: [], loading: false, error: null })
      renderPage()
      expect(screen.queryByTestId("invite-dialog")).not.toBeInTheDocument()
    })

    it("opens invite dialog when Invite User button in header is clicked", () => {
      mockUseUsers.mockReturnValue({ data: [makeUser()], loading: false, error: null })
      renderPage()
      const headerButton = screen.getByRole("button", { name: /invite user/i })
      fireEvent.click(headerButton)
      expect(screen.getByTestId("invite-dialog")).toBeInTheDocument()
    })

    it("opens invite dialog from empty state CTA", () => {
      mockUseUsers.mockReturnValue({ data: [], loading: false, error: null })
      renderPage()
      // EmptyState action button
      const emptyStateButton = screen.getAllByRole("button", { name: /invite user/i })[0]!
      fireEvent.click(emptyStateButton)
      expect(screen.getByTestId("invite-dialog")).toBeInTheDocument()
    })
  })

  describe("tabs", () => {
    it("renders Team and Project Access tabs", () => {
      mockUseUsers.mockReturnValue({ data: [makeUser()], loading: false, error: null })
      renderPage()
      expect(screen.getByRole("tab", { name: /team/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /project access/i })).toBeInTheDocument()
    })

    it("shows Team tab content by default", () => {
      mockUseUsers.mockReturnValue({
        data: [makeUser({ id: "u1", email: "alice@example.com", displayName: "Alice" })],
        loading: false,
        error: null,
      })
      renderPage()
      // The roster table should be visible by default
      expect(screen.getByText("alice@example.com")).toBeInTheDocument()
      // ProjectAccessTab should not be visible
      expect(screen.queryByTestId("project-access-tab")).not.toBeInTheDocument()
    })

    it("switches to Project Access tab on click", async () => {
      mockUseUsers.mockReturnValue({ data: [makeUser()], loading: false, error: null })
      renderPage()
      const user = userEvent.setup()
      await user.click(screen.getByRole("tab", { name: /project access/i }))
      await waitFor(() => {
        expect(screen.getByTestId("project-access-tab")).toBeInTheDocument()
      })
    })

    it("switches back to Team tab from Project Access", async () => {
      mockUseUsers.mockReturnValue({
        data: [makeUser({ id: "u1", email: "alice@example.com" })],
        loading: false,
        error: null,
      })
      renderPage()
      const user = userEvent.setup()
      // Go to Project Access
      await user.click(screen.getByRole("tab", { name: /project access/i }))
      await waitFor(() => {
        expect(screen.getByTestId("project-access-tab")).toBeInTheDocument()
      })
      // Go back to Team
      await user.click(screen.getByRole("tab", { name: /team/i }))
      await waitFor(() => {
        expect(screen.getByText("alice@example.com")).toBeInTheDocument()
      })
    })
  })
})
