/// <reference types="@testing-library/jest-dom" />
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ShotReferenceLinksSection } from "@/features/shots/components/ShotReferenceLinksSection"

if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {}
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {}
}

describe("ShotReferenceLinksSection", () => {
  it("shows and imports one-time migration suggestions from notes", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)
    window.localStorage.clear()

    render(
      <ShotReferenceLinksSection
        shotId="s2"
        referenceLinks={[]}
        notesAddendum="Refs https://example.com/deck and https://loom.com/share/abc"
        canEdit={true}
        onSaveReferenceLinks={onSave}
      />,
    )

    expect(screen.getByText(/Found 2 URLs in notes/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Import links" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0] as ReadonlyArray<Record<string, unknown>>
    expect(payload).toEqual([
      expect.objectContaining({ url: "https://example.com/deck", type: "web" }),
      expect.objectContaining({ url: "https://loom.com/share/abc", type: "video" }),
    ])
  })

  it("renders icon/title style links without printing full URL by default", () => {
    render(
      <ShotReferenceLinksSection
        shotId="s1"
        referenceLinks={[
          {
            id: "lk-1",
            title: "Creative Brief",
            url: "https://example.com/files/brief.pdf",
            type: "document",
          },
        ]}
        canEdit={false}
        onSaveReferenceLinks={() => Promise.resolve()}
      />,
    )

    expect(screen.getByRole("link", { name: /Creative Brief/i })).toBeInTheDocument()
    expect(screen.queryByText("https://example.com/files/brief.pdf")).not.toBeInTheDocument()
    expect(screen.getByText("example.com")).toBeInTheDocument()
  })

  it("adds a new link with inferred type", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ShotReferenceLinksSection
        shotId="s1"
        referenceLinks={[]}
        canEdit={true}
        onSaveReferenceLinks={onSave}
      />,
    )

    await user.type(screen.getByLabelText("Reference link title"), "Lighting Ref")
    await user.type(screen.getByLabelText("Reference link URL"), "loom.com/share/abc")
    await user.click(screen.getByRole("button", { name: "Add link" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0] as ReadonlyArray<Record<string, unknown>>
    expect(payload).toHaveLength(1)
    expect(payload[0]).toEqual(
      expect.objectContaining({
        title: "Lighting Ref",
        url: "https://loom.com/share/abc",
        type: "video",
      }),
    )
    expect(typeof payload[0]?.id).toBe("string")
  })

  it("removes an existing link when remove is pressed", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ShotReferenceLinksSection
        shotId="s1"
        referenceLinks={[
          {
            id: "lk-1",
            title: "Deck",
            url: "https://example.com/deck",
            type: "web",
          },
        ]}
        canEdit={true}
        onSaveReferenceLinks={onSave}
      />,
    )

    await user.click(screen.getByRole("button", { name: /remove deck/i }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith([])
    })
  })

  it("edits an existing link title, url, and type", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <ShotReferenceLinksSection
        shotId="s1"
        referenceLinks={[
          {
            id: "lk-1",
            title: "Deck",
            url: "https://example.com/deck",
            type: "web",
          },
        ]}
        canEdit={true}
        onSaveReferenceLinks={onSave}
      />,
    )

    await user.click(screen.getByRole("button", { name: /edit deck/i }))
    await user.clear(screen.getByLabelText("Edit reference link title"))
    await user.type(screen.getByLabelText("Edit reference link title"), "Creative Treatment")
    await user.clear(screen.getByLabelText("Edit reference link URL"))
    await user.type(screen.getByLabelText("Edit reference link URL"), "drive.google.com/file/d/abc")
    await user.click(screen.getByLabelText("Edit reference link type"))
    await user.click(screen.getByText("Document"))
    await user.click(screen.getByRole("button", { name: "Save changes" }))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1)
    })

    const payload = onSave.mock.calls[0]?.[0] as ReadonlyArray<Record<string, unknown>>
    expect(payload).toEqual([
      expect.objectContaining({
        id: "lk-1",
        title: "Creative Treatment",
        url: "https://drive.google.com/file/d/abc",
        type: "document",
      }),
    ])
  })

  it("can dismiss migration prompt for this shot", async () => {
    const user = userEvent.setup()
    window.localStorage.clear()

    render(
      <ShotReferenceLinksSection
        shotId="s3"
        referenceLinks={[]}
        notesAddendum="https://example.com/deck"
        canEdit={true}
        onSaveReferenceLinks={() => Promise.resolve()}
      />,
    )

    expect(screen.getByText(/Found 1 URL in notes/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Not now" }))
    expect(screen.queryByText(/Found 1 URL in notes/i)).not.toBeInTheDocument()
    expect(window.localStorage.getItem("sb:shots:ref-links-migration-dismissed:s3:v1")).toBe("1")
  })
})
