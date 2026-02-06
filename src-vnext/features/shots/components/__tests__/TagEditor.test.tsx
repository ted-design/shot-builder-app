/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ShotTag } from "@/shared/types"

vi.mock("@/features/shots/hooks/useAvailableTags", () => ({
  useAvailableTags: () => ({
    tags: [{ id: "t1", label: "Photo", color: "emerald", usageCount: 2, isDefault: true }],
    loading: false,
    error: null,
  }),
}))

import { TagEditor } from "@/features/shots/components/TagEditor"

describe("TagEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("creates a new tag and saves on demand", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (_next: readonly ShotTag[]) => true)

    render(<TagEditor tags={[]} onSave={onSave} />)

    await user.click(screen.getByRole("button", { name: /add tags/i }))

    fireEvent.change(screen.getByPlaceholderText("Search or create…"), {
      target: { value: "New Tag" },
    })

    await user.click(screen.getByRole("button", { name: "Create" }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ label: "New Tag", color: "blue", category: "other" }),
    ])
  })

  it("adds an existing tag and saves", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn(async (_next: readonly ShotTag[]) => true)

    render(<TagEditor tags={[]} onSave={onSave} />)

    await user.click(screen.getByRole("button", { name: /add tags/i }))
    await user.click(screen.getByTestId("tag-option-t1"))
    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    expect(onSave).toHaveBeenCalledWith([
      expect.objectContaining({ id: "t1", label: "Photo", color: "emerald", category: "other" }),
    ])
  })
})
