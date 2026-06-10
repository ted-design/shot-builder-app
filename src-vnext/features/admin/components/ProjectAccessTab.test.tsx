/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ProjectMember } from "@/features/admin/hooks/useProjectMembers"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: "admin",
    user: { uid: "admin-1", email: "admin@example.com", displayName: "Admin", photoURL: null },
  }),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [{ id: "p1", name: "Project One" }],
    loading: false,
    error: null,
  }),
}))

const usersState = vi.hoisted(() => ({
  users: [] as Array<{ id: string; email: string; displayName?: string | null; role: string }>,
}))

vi.mock("@/features/admin/hooks/useUsers", () => ({
  useUsers: () => ({ data: usersState.users, loading: false, error: null }),
}))

const membersState = vi.hoisted(() => ({
  members: [] as ProjectMember[],
}))

vi.mock("@/features/admin/hooks/useProjectMembers", () => ({
  useProjectMembers: () => ({ data: membersState.members, loading: false, error: null }),
}))

vi.mock("@/features/admin/lib/adminWrites", () => ({
  removeProjectMember: vi.fn(),
}))

vi.mock("@/features/admin/components/AddProjectMemberDialog", () => ({
  AddProjectMemberDialog: () => null,
}))

// Mock the Radix Select primitive with a trivial native <select> so that
// jsdom-driven tests can drive onValueChange without Radix's pointer-capture
// polyfill. The real Select is exercised in e2e. (Same pattern as
// CallOverridesEditor.test.tsx.)
vi.mock("@/ui/select", async () => {
  const React = await import("react")
  interface SelectProps {
    readonly children?: React.ReactNode
    readonly value?: string
    readonly onValueChange?: (value: string) => void
  }
  interface SelectItemProps {
    readonly children?: React.ReactNode
    readonly value: string
  }
  const MOCK_SELECT_ITEM_TYPE = Symbol.for("mock-select-item")
  const Select = ({ children, value, onValueChange }: SelectProps) => {
    const options: { value: string; label: string }[] = []
    const visit = (node: React.ReactNode): void => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return
        const elType = child.type as unknown
        if (
          typeof elType === "function" &&
          (elType as { mockSelectItemTag?: symbol }).mockSelectItemTag === MOCK_SELECT_ITEM_TYPE
        ) {
          const props = child.props as SelectItemProps
          const label = typeof props.children === "string" ? props.children : props.value
          options.push({ value: props.value, label })
          return
        }
        const props = child.props as { children?: React.ReactNode }
        if (props?.children !== undefined) visit(props.children)
      })
    }
    visit(children)
    return React.createElement(
      "select",
      {
        "data-testid": "mock-select",
        "aria-label": "mock-select",
        value: value ?? "",
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange?.(e.target.value),
      },
      React.createElement("option", { key: "__placeholder__", value: "" }, "placeholder"),
      ...options.map((o) =>
        React.createElement("option", { key: o.value, value: o.value }, o.label),
      ),
    )
  }
  const SelectItem = ({ children }: SelectItemProps) => React.createElement(React.Fragment, null, children)
  ;(SelectItem as unknown as { mockSelectItemTag: symbol }).mockSelectItemTag = MOCK_SELECT_ITEM_TYPE
  const Passthrough = ({ children }: { readonly children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return {
    Select,
    SelectContent: Passthrough,
    SelectTrigger: Passthrough,
    SelectValue: Passthrough,
    SelectItem,
  }
})

import { ProjectAccessTab } from "@/features/admin/components/ProjectAccessTab"

async function renderWithProjectSelected() {
  const user = userEvent.setup()
  render(<ProjectAccessTab />)
  await user.selectOptions(screen.getByTestId("mock-select"), "p1")
  return user
}

describe("ProjectAccessTab effective-access copy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersState.users = []
    membersState.members = []
  })

  it("shows downgrade copy when the member doc ranks below the global claim", async () => {
    usersState.users = [
      { id: "u1", email: "pat@example.com", displayName: "Pat", role: "producer" },
    ]
    membersState.members = [{ id: "u1", role: "viewer" }]

    await renderWithProjectSelected()

    expect(screen.getByTestId("project-access-effective-role")).toHaveTextContent(
      "Effective here: Viewer (downgraded from global Producer)",
    )
  })

  it("shows promote copy when the member doc ranks above the global claim", async () => {
    usersState.users = [
      { id: "u1", email: "cam@example.com", displayName: "Cam", role: "crew" },
    ]
    membersState.members = [{ id: "u1", role: "producer" }]

    await renderWithProjectSelected()

    expect(screen.getByTestId("project-access-effective-role")).toHaveTextContent(
      "Effective here: Producer (promoted from global Crew)",
    )
  })

  it("shows the admin exception for a globally-admin member (project role has no effect)", async () => {
    usersState.users = [
      { id: "u1", email: "ada@example.com", displayName: "Ada", role: "admin" },
    ]
    membersState.members = [{ id: "u1", role: "viewer" }]

    await renderWithProjectSelected()

    expect(screen.getByTestId("project-access-effective-role")).toHaveTextContent(
      "Admin globally — project role has no effect",
    )
  })

  it("renders no diagnostic when project and global roles agree", async () => {
    usersState.users = [
      { id: "u1", email: "pat@example.com", displayName: "Pat", role: "producer" },
    ]
    membersState.members = [{ id: "u1", role: "producer" }]

    await renderWithProjectSelected()

    expect(screen.getByText("Producer")).toBeInTheDocument()
    expect(screen.queryByTestId("project-access-effective-role")).not.toBeInTheDocument()
  })

  it("treats crew<->warehouse as lateral (no downgrade/promote copy)", async () => {
    usersState.users = [
      { id: "u1", email: "wes@example.com", displayName: "Wes", role: "crew" },
    ]
    membersState.members = [{ id: "u1", role: "warehouse" }]

    await renderWithProjectSelected()

    expect(screen.getByText("Warehouse")).toBeInTheDocument()
    expect(screen.queryByTestId("project-access-effective-role")).not.toBeInTheDocument()
  })

  it("normalizes a legacy 'wardrobe' member-doc role to Warehouse (matches useEffectiveRole)", async () => {
    usersState.users = [
      { id: "u1", email: "lee@example.com", displayName: "Lee", role: "producer" },
    ]
    membersState.members = [{ id: "u1", role: "wardrobe" }]

    await renderWithProjectSelected()

    expect(screen.getByText("Warehouse")).toBeInTheDocument()
    expect(screen.getByTestId("project-access-effective-role")).toHaveTextContent(
      "Effective here: Warehouse (downgraded from global Producer)",
    )
  })
})
