/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import type { ShotComment } from "@/shared/types"

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

// Role is mutable per-test so the 5f-II Q4 collapse can flip producer ↔ viewer.
// Default is "producer" — every pre-existing test below relies on it.
const authState = vi.hoisted(() => ({ role: "producer" as string }))
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
    authState.role = "producer"
  })

  it("shows an empty state when no comments exist", () => {
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment />)

    expect(screen.getByText("No comments yet")).toBeInTheDocument()
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

  // ── Decision C (5e-II) — offline queued-post affordance ───────────────────
  // The `offline` prop is passed ONLY by the Shoot shell; every existing call
  // site omits it, so the default-path tests above stay the byte-identical
  // flag-OFF contract.

  it("offline: shows the quiet queued-post note next to the composer", () => {
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment offline />)

    expect(
      screen.getByText("Offline — comments post when you reconnect"),
    ).toBeInTheDocument()
  })

  it("default (no offline prop): no queued-post note", () => {
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment />)

    expect(screen.queryByTestId("comments-offline-note")).not.toBeInTheDocument()
  })

  it("offline post is fire-and-forget: draft clears immediately and the composer never locks on a promise that only resolves on reconnect", async () => {
    const user = userEvent.setup()
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    // An offline addDoc promise resolves only on server ack — model that
    // with a promise that never settles during the test.
    ;(createShotComment as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(
      new Promise(() => {}),
    )

    render(<ShotCommentsSection shotId="s1" canComment offline />)

    const textarea = screen.getByPlaceholderText("Leave a note for your team…")
    await user.type(textarea, "Queued from set")
    await user.click(screen.getByRole("button", { name: "Post" }))

    expect(createShotComment).toHaveBeenCalledWith({
      clientId: "c1",
      shotId: "s1",
      body: "Queued from set",
      userId: "u1",
      userName: "Alex Rivera",
      userAvatar: null,
    })
    // Cleared synchronously — no await on the unsettled write.
    expect(textarea).toHaveValue("")
    // Composer stays usable for the next comment (no `saving` lock).
    expect(textarea).not.toBeDisabled()
  })

  it("offline post failure still surfaces a toast through the detached catch", async () => {
    const user = userEvent.setup()
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })
    ;(createShotComment as unknown as { mockRejectedValue: (v: unknown) => void }).mockRejectedValue(
      new Error("Comment cannot exceed 2000 characters."),
    )

    render(<ShotCommentsSection shotId="s1" canComment offline />)

    await user.type(
      screen.getByPlaceholderText("Leave a note for your team…"),
      "Too long",
    )
    await user.click(screen.getByRole("button", { name: "Post" }))

    const { toast } = await import("sonner")
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Comment cannot exceed 2000 characters.")
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

  // ── Q4 / 5f-II — the writeAuthoritative composer-authority collapse ───────
  // writeAuthoritative bypasses the internal canManageShots(role) term so a
  // viewer/client (whom canManageShots excludes) gets an OPEN composer. Passed
  // ONLY by the Review shell; every other call site omits it, so the default
  // double gate (canComment prop AND canManageShots) is byte-identical. The
  // clientId / user?.uid guards still run; author-only delete is unaffected.

  it("writeAuthoritative + canComment: a VIEWER gets an ENABLED composer (no Read-only badge)", () => {
    authState.role = "viewer"
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment writeAuthoritative />)

    // The composer is open and the Read-only badge is gone — the canManageShots
    // term (which excludes viewer) was bypassed by writeAuthoritative.
    expect(
      screen.getByPlaceholderText("Leave a note for your team…"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Read-only")).not.toBeInTheDocument()
  })

  it("writeAuthoritative respects canComment=false: still read-only (the prop only RELAXES toward canComment, never widens past it)", () => {
    authState.role = "viewer"
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment={false} writeAuthoritative />)

    expect(screen.getByText("Read-only")).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText("Leave a note for your team…"),
    ).not.toBeInTheDocument()
  })

  it("WITHOUT writeAuthoritative a VIEWER stays read-only — the default double gate is byte-identical (canManageShots excludes viewer)", () => {
    authState.role = "viewer"
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    // canComment=true but the prop is omitted → canManageShots('viewer') === false
    // keeps the composer closed (the producer editor + Shoot shell path).
    render(<ShotCommentsSection shotId="s1" canComment />)

    expect(screen.getByText("Read-only")).toBeInTheDocument()
    expect(
      screen.queryByPlaceholderText("Leave a note for your team…"),
    ).not.toBeInTheDocument()
  })

  it("WITHOUT writeAuthoritative a PRODUCER stays ENABLED — the shared producer/shoot callers are unaffected", () => {
    authState.role = "producer"
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment />)

    expect(
      screen.getByPlaceholderText("Leave a note for your team…"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Read-only")).not.toBeInTheDocument()
  })

  it("a client (writeAuthoritative viewer) can still only post as themselves — author-only delete invariant unchanged", () => {
    authState.role = "viewer"
    ;(useShotComments as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      // A comment authored by SOMEONE ELSE — the viewer must NOT see a
      // delete/remove affordance on it (only admins or the author do).
      data: [makeComment({ id: "cm-x", body: "Not yours", createdBy: "other-uid" })],
      loading: false,
      error: null,
    })

    render(<ShotCommentsSection shotId="s1" canComment writeAuthoritative />)

    // Composer is open (Q4)…
    expect(
      screen.getByPlaceholderText("Leave a note for your team…"),
    ).toBeInTheDocument()
    // …but no delete/remove control on another user's comment.
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument()
    // Guard against an accidental no-op assertion: the comment IS rendered.
    expect(screen.getByText("Not yours")).toBeInTheDocument()
  })
})
