/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { UseEntityPresenceResult } from "@/shared/types/presence"
import type { Timestamp } from "firebase/firestore"

// ---- Mocks ----

const mockPresenceResult: UseEntityPresenceResult = {
  locks: {},
  activeEditors: [],
  isLoading: false,
  hasActiveEditors: false,
}

vi.mock("@/features/shots/hooks/useEntityPresence", () => ({
  useEntityPresence: () => mockPresenceResult,
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "me" } }),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

import {
  ActiveEditorsBar,
  CompactActiveEditors,
} from "@/features/shots/components/ActiveEditorsBar"

const ts = { toDate: () => new Date() } as unknown as Timestamp

function setPresence(partial: Partial<UseEntityPresenceResult>) {
  Object.assign(mockPresenceResult, {
    locks: {},
    activeEditors: [],
    isLoading: false,
    hasActiveEditors: false,
    ...partial,
  })
}

beforeEach(() => {
  setPresence({})
})

// ---------------------------------------------------------------------------
// ActiveEditorsBar
// ---------------------------------------------------------------------------

describe("ActiveEditorsBar", () => {
  it("renders nothing when no active editors", () => {
    const { container } = render(
      <ActiveEditorsBar clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing while loading", () => {
    setPresence({ isLoading: true })
    const { container } = render(
      <ActiveEditorsBar clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders bar when active editors present", () => {
    setPresence({
      hasActiveEditors: true,
      activeEditors: [
        {
          userId: "u2",
          userName: "Bob",
          userAvatar: null,
          fields: ["title"],
          lastActivity: ts,
        },
      ],
    })
    render(
      <ActiveEditorsBar clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(screen.getByTestId("active-editors-bar")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("is editing")).toBeInTheDocument()
  })

  it("shows plural text for multiple editors", () => {
    setPresence({
      hasActiveEditors: true,
      activeEditors: [
        { userId: "u2", userName: "Bob", userAvatar: null, fields: ["title"], lastActivity: ts },
        { userId: "u3", userName: "Carol", userAvatar: null, fields: ["notes"], lastActivity: ts },
      ],
    })
    render(
      <ActiveEditorsBar clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(screen.getByText("2 people")).toBeInTheDocument()
    expect(screen.getByText("are editing")).toBeInTheDocument()
  })

  it("expands to show per-editor details on click", () => {
    setPresence({
      hasActiveEditors: true,
      activeEditors: [
        { userId: "u2", userName: "Bob", userAvatar: null, fields: ["title"], lastActivity: ts },
      ],
    })
    render(
      <ActiveEditorsBar clientId="c1" entityType="shots" entityId="s1" />,
    )
    // Expand
    fireEvent.click(screen.getByRole("button"))
    expect(screen.getByText("is editing Title")).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// CompactActiveEditors
// ---------------------------------------------------------------------------

describe("CompactActiveEditors", () => {
  it("renders nothing when no active editors", () => {
    const { container } = render(
      <CompactActiveEditors clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders avatar dots when editors present", () => {
    setPresence({
      hasActiveEditors: true,
      activeEditors: [
        { userId: "u2", userName: "Bob", userAvatar: null, fields: ["title"], lastActivity: ts },
      ],
    })
    render(
      <CompactActiveEditors clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(screen.getByTestId("compact-active-editors")).toBeInTheDocument()
  })

  it("shows overflow count for 4+ editors", () => {
    setPresence({
      hasActiveEditors: true,
      activeEditors: [
        { userId: "u1", userName: "Alice", userAvatar: null, fields: ["title"], lastActivity: ts },
        { userId: "u2", userName: "Bob", userAvatar: null, fields: ["notes"], lastActivity: ts },
        { userId: "u3", userName: "Carol", userAvatar: null, fields: ["desc"], lastActivity: ts },
        { userId: "u4", userName: "Dave", userAvatar: null, fields: ["tags"], lastActivity: ts },
      ],
    })
    render(
      <CompactActiveEditors clientId="c1" entityType="shots" entityId="s1" />,
    )
    expect(screen.getByText("+1")).toBeInTheDocument()
  })
})
