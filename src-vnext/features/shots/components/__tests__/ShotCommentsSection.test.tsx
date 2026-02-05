/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import type { ShotComment } from "@/shared/types"

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "c1",
    role: "producer",
    user: {
      uid: "u1",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      photoURL: null,
    },
  }),
}))

vi.mock("@/features/shots/hooks/useShotComments", () => ({
  useShotComments: vi.fn(),
}))

vi.mock("@/features/shots/lib/shotCommentWrites", () => ({
  createShotComment: vi.fn(),
  setShotCommentDeleted: vi.fn(),
}))

import { useShotComments } from "@/features/shots/hooks/useShotComments"
import {
  createShotComment,
  setShotCommentDeleted,
} from "@/features/shots/lib/shotCommentWrites"
import { ShotCommentsSection } from "@/features/shots/components/ShotCommentsSection"

function makeComment(overrides: Partial<ShotComment>): ShotComment {
  return {
    id: overrides.id ?? "c1",
    body: overrides.body ?? "Hello",
    createdAt: overrides.createdAt ?? Timestamp.fromMillis(Date.now()),
    createdBy: overrides.createdBy ?? "u1",
    createdByName: overrides.createdByName ?? "Alex Rivera",
    createdByAvatar: overrides.createdByAvatar ?? null,
    deleted: overrides.deleted ?? false,
  }
}

describe("ShotCommentsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows an empty state when no comments exist", () => {
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment />)

    expect(screen.getByText("No comments yet.")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("Leave a note for your team…")).toBeInTheDocument()
  })

  it("is read-only when commenting is disabled", () => {
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment={false} />)

    expect(screen.getByText("Read-only")).toBeInTheDocument()
    expect(screen.queryByPlaceholderText("Leave a note for your team…")).not.toBeInTheDocument()
  })

  it("creates a comment and clears the draft", async () => {
    const user = userEvent.setup()
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    ;(createShotComment as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue("new-id")

    render(<ShotCommentsSection shotId="s1" canComment />)

    const textarea = screen.getByPlaceholderText("Leave a note for your team…")
    await user.type(textarea, "New comment")
    await user.click(screen.getByRole("button", { name: "Post" }))

    expect(createShotComment).toHaveBeenCalledWith({
      clientId: "c1",
      shotId: "s1",
      body: "New comment",
      userId: "u1",
      userName: "Alex Rivera",
      userAvatar: null,
    })

    await waitFor(() => {
      expect(textarea).toHaveValue("")
    })
  })

  it("allows deleting your own comment", async () => {
    const user = userEvent.setup()
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [makeComment({ id: "cm-1", body: "To delete", createdBy: "u1" })],
      loading: false,
      error: null,
    })
    ;(setShotCommentDeleted as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(undefined)

    render(<ShotCommentsSection shotId="s1" canComment />)

    await user.click(screen.getByRole("button", { name: "Delete" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    expect(setShotCommentDeleted).toHaveBeenCalledWith({
      clientId: "c1",
      shotId: "s1",
      commentId: "cm-1",
      deleted: true,
    })
  })
})
