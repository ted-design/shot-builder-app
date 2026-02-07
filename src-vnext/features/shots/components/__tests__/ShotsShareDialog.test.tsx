/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/shared/lib/firebase", () => ({
  functions: {},
  db: {},
}))

vi.mock("firebase/functions", () => ({
  httpsCallable: vi.fn(),
}))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { httpsCallable } from "firebase/functions"
import { doc, setDoc } from "firebase/firestore"
import { toast } from "sonner"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"

describe("ShotsShareDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it("creates a share link via callable and updates the UI", async () => {
    const callable = vi.fn().mockResolvedValue({ data: { shareToken: "token_1234567890" } })
    ;(httpsCallable as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(callable)

    render(
      <ShotsShareDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        projectId="p1"
        projectName="Project 1"
        user={null}
        selectedShotIds={[]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Create link" }))

    await waitFor(() => {
      expect(httpsCallable).toHaveBeenCalledWith({}, "createShotShareLink")
    })

    expect(callable).toHaveBeenCalledWith({
      projectId: "p1",
      scope: "project",
      shotIds: null,
      title: "Project 1 — Shots",
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })

    expect(
      screen.getByText(/\/shots\/shared\/token_1234567890/),
    ).toBeInTheDocument()
  })

  it("surfaces callable errors with code/message", async () => {
    const callable = vi.fn().mockRejectedValue({
      code: "functions/permission-denied",
      message: "Permission denied",
    })
    ;(httpsCallable as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(callable)

    render(
      <ShotsShareDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        projectId="p1"
        projectName="Project 1"
        user={null}
        selectedShotIds={[]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Create link" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to create share link",
        expect.objectContaining({
          description: expect.stringContaining("functions/permission-denied"),
        }),
      )
    })
  })

  it("falls back to Firestore when callable is unavailable", async () => {
    const callable = vi.fn().mockRejectedValue({
      code: "functions/not-found",
      message: "Function not found",
    })
    ;(httpsCallable as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue(callable)
    ;(doc as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue("doc-ref")
    ;(setDoc as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(undefined)

    render(
      <ShotsShareDialog
        open
        onOpenChange={vi.fn()}
        clientId="c1"
        projectId="p1"
        projectName="Project 1"
        user={{ uid: "u1", email: "producer@test.com", displayName: null, photoURL: null }}
        selectedShotIds={[]}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Create link" }))

    await waitFor(() => {
      expect(setDoc).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })
  })
})
