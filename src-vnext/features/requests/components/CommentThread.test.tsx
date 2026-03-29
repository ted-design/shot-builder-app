/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { Timestamp } from "firebase/firestore"

// ---- Mocks ----

const mockUseRequestComments = vi.fn()
const mockAddRequestComment = vi.fn()

vi.mock("@/features/requests/hooks/useRequestComments", () => ({
  useRequestComments: (...args: unknown[]) => mockUseRequestComments(...args),
}))

vi.mock("@/features/requests/lib/requestWrites", () => ({
  addRequestComment: (...args: unknown[]) => mockAddRequestComment(...args),
}))

vi.mock("@/features/requests/lib/formatRelativeTime", () => ({
  formatRelativeTime: () => "just now",
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import { toast } from "sonner"
import { CommentThread } from "./CommentThread"

const mockToast = toast as unknown as { error: ReturnType<typeof vi.fn> }

function makeTimestamp(): Timestamp {
  return { toMillis: () => Date.now() } as unknown as Timestamp
}

function renderThread(overrides?: { clientId?: string; requestId?: string }) {
  const props = {
    clientId: overrides?.clientId ?? "c1",
    requestId: overrides?.requestId ?? "req-1",
    currentUser: { uid: "user-1", displayName: "Alice" },
  }
  return render(<CommentThread {...props} />)
}

describe("CommentThread", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddRequestComment.mockResolvedValue(undefined)
    mockUseRequestComments.mockReturnValue({
      comments: [],
      loading: false,
      error: null,
    })
  })

  it("shows empty state when there are no comments", () => {
    renderThread()
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument()
  })

  it("shows loading text while loading", () => {
    mockUseRequestComments.mockReturnValue({
      comments: [],
      loading: true,
      error: null,
    })
    renderThread()
    expect(screen.getByText(/loading comments/i)).toBeInTheDocument()
  })

  it("renders a list of comments", () => {
    mockUseRequestComments.mockReturnValue({
      comments: [
        { id: "c1", authorId: "user-1", authorName: "Alice", body: "First comment", createdAt: makeTimestamp() },
        { id: "c2", authorId: "user-2", authorName: "Bob", body: "Second comment", createdAt: makeTimestamp() },
      ],
      loading: false,
      error: null,
    })
    renderThread()
    expect(screen.getByText("First comment")).toBeInTheDocument()
    expect(screen.getByText("Second comment")).toBeInTheDocument()
    expect(screen.getByText("Alice")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
  })

  it("renders the comment input", () => {
    renderThread()
    expect(screen.getByPlaceholderText(/add a comment/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /send comment/i })).toBeInTheDocument()
  })

  it("send button is disabled when input is empty", () => {
    renderThread()
    expect(screen.getByRole("button", { name: /send comment/i })).toBeDisabled()
  })

  it("send button is enabled when input has text", () => {
    renderThread()
    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "Hello there" },
    })
    expect(screen.getByRole("button", { name: /send comment/i })).toBeEnabled()
  })

  it("calls addRequestComment on send button click", async () => {
    renderThread()
    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "Nice shot!" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send comment/i }))

    await waitFor(() => {
      expect(mockAddRequestComment).toHaveBeenCalledWith(
        "c1",
        "req-1",
        "Nice shot!",
        { uid: "user-1", displayName: "Alice" },
      )
    })
  })

  it("clears input after successful submit", async () => {
    renderThread()
    const input = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(input, { target: { value: "My comment" } })
    fireEvent.click(screen.getByRole("button", { name: /send comment/i }))

    await waitFor(() => {
      expect(mockAddRequestComment).toHaveBeenCalled()
    })
    expect(input).toHaveValue("")
  })

  it("submits on Enter key", async () => {
    renderThread()
    const input = screen.getByPlaceholderText(/add a comment/i)
    fireEvent.change(input, { target: { value: "Enter key submit" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockAddRequestComment).toHaveBeenCalledWith(
        "c1",
        "req-1",
        "Enter key submit",
        expect.any(Object),
      )
    })
  })

  it("shows error toast when addRequestComment fails", async () => {
    mockAddRequestComment.mockRejectedValue(new Error("permission-denied"))
    renderThread()
    fireEvent.change(screen.getByPlaceholderText(/add a comment/i), {
      target: { value: "Failing comment" },
    })
    fireEvent.click(screen.getByRole("button", { name: /send comment/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("permission-denied")
    })
  })

  it("shows avatar initial for current user comment", () => {
    mockUseRequestComments.mockReturnValue({
      comments: [
        { id: "c1", authorId: "user-1", authorName: "Alice", body: "My message", createdAt: makeTimestamp() },
      ],
      loading: false,
      error: null,
    })
    renderThread()
    // Avatar shows first letter of name
    expect(screen.getByText("A")).toBeInTheDocument()
  })

  it("passes clientId and requestId to useRequestComments", () => {
    renderThread({ clientId: "client-abc", requestId: "req-xyz" })
    expect(mockUseRequestComments).toHaveBeenCalledWith("client-abc", "req-xyz")
  })
})
