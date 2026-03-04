/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/shared/lib/firebase", () => ({
  db: {},
}))

vi.mock("@/shared/lib/callFunction", () => ({
  callFunction: vi.fn(),
}))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  serverTimestamp: vi.fn(() => "server-timestamp"),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
}))

vi.mock("@/features/shots/lib/resolveShotsForShare", () => ({
  resolveShotsForShare: vi.fn().mockResolvedValue({
    projectName: "Project 1",
    resolvedShots: [],
  }),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { callFunction } from "@/shared/lib/callFunction"
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

  it("creates a share link via callFunction and updates the UI", async () => {
    ;(callFunction as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      shareToken: "token_1234567890",
    })

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
      expect(callFunction).toHaveBeenCalledWith(
        "createShotShareLink",
        {
          projectId: "p1",
          scope: "project",
          shotIds: null,
          title: "Project 1 — Shots",
        },
      )
    })

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled()
    })

    expect(
      screen.getByText(/\/shots\/shared\/token_1234567890/),
    ).toBeInTheDocument()
  })

  it("surfaces callFunction errors with code/message", async () => {
    ;(callFunction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "functions/permission-denied",
      message: "Permission denied",
    })

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

  it("falls back to Firestore when callFunction returns internal error (IAM)", async () => {
    ;(callFunction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "functions/internal",
      message: "INTERNAL",
    })
    ;(doc as unknown as ReturnType<typeof vi.fn>).mockReturnValue("doc-ref")
    ;(setDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

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

  it("falls back to Firestore when callFunction is unavailable", async () => {
    ;(callFunction as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      code: "functions/not-found",
      message: "Function not found",
    })
    ;(doc as unknown as ReturnType<typeof vi.fn>).mockReturnValue("doc-ref")
    ;(setDoc as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

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
