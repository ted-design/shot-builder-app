/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import { NotesSection } from "./NotesSection"

describe("NotesSection", () => {
  it("renders sanitized HTML notes", () => {
    render(
      <NotesSection
        notes="<p>Legacy <strong>formatted</strong> notes</p>"
        notesAddendum={null}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={false}
      />,
    )
    const prose = document.querySelector(".prose")
    expect(prose).not.toBeNull()
    expect(prose!.innerHTML).toContain("<strong>formatted</strong>")
  })

  it("shows empty state when notes are missing", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum={null}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={false}
      />,
    )
    expect(screen.getByText("No notes yet")).toBeInTheDocument()
  })

  it("starts in read mode and enters edit mode on click", () => {
    render(
      <NotesSection
        notes="<p>Some notes</p>"
        notesAddendum={null}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
    // Read mode: no textarea visible
    expect(screen.queryByTestId("notes-input")).not.toBeInTheDocument()
    expect(screen.getByTestId("notes-read-mode")).toBeInTheDocument()
    expect(screen.getByText("Legacy Notes (Read-only)")).toBeInTheDocument()

    // Click to enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    expect(screen.getByTestId("notes-input")).toBeInTheDocument()
  })

  it("prefills editable notes with existing content after entering edit mode", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum={"Line one\nLine two"}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
    // Click read mode to enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    const textarea = screen.getByTestId("notes-input") as HTMLTextAreaElement
    expect(textarea.value).toContain("Line one")
    expect(textarea.value).toContain("Line two")
  })

  it("auto-saves edited notes with trimmed value after debounce", async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <NotesSection
        notes={null}
        notesAddendum="Prior entry"
        onSaveAddendum={onSave}
        canEditAddendum={true}
      />,
    )

    // Enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    const textarea = screen.getByTestId("notes-input")
    fireEvent.change(textarea, { target: { value: "  Updated text  " } })

    // Not called yet (debounce pending)
    expect(onSave).not.toHaveBeenCalled()

    // Advance past 1500ms debounce
    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(onSave).toHaveBeenCalledWith("Updated text")
    vi.useRealTimers()
  })

  it("does not auto-save when notes have not changed", () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <NotesSection
        notes={null}
        notesAddendum="Same"
        onSaveAddendum={onSave}
        canEditAddendum={true}
      />,
    )

    // Enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    const textarea = screen.getByTestId("notes-input")
    // Type the same trimmed value
    fireEvent.change(textarea, { target: { value: "Same" } })

    vi.advanceTimersByTime(2000)
    expect(onSave).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it("retains draft text when notes auto-save fails", async () => {
    vi.useFakeTimers()
    const onSave = vi.fn().mockRejectedValue(new Error("Firestore write failed"))
    render(
      <NotesSection
        notes={null}
        notesAddendum="Existing"
        onSaveAddendum={onSave}
        canEditAddendum={true}
      />,
    )

    // Enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    const textarea = screen.getByTestId("notes-input") as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: "Important note" } })

    await act(async () => {
      vi.advanceTimersByTime(1500)
    })

    expect(onSave).toHaveBeenCalledWith("Important note")
    // Draft preserved despite failure
    expect(textarea.value).toBe("Important note")
    vi.useRealTimers()
  })

  it("shows read-only notes when editing is not allowed", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum="Read-only text"
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={false}
      />,
    )
    expect(screen.queryByTestId("notes-input")).not.toBeInTheDocument()
    expect(screen.getByText("Read-only text")).toBeInTheDocument()
  })

  it("renders clickable URL links in read-only mode", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum="Ref: https://example.com/reference"
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={false}
      />,
    )

    const link = screen.getByRole("link", { name: "https://example.com/reference" })
    expect(link).toHaveAttribute("href", "https://example.com/reference")
  })

  it("shows placeholder text in read mode when addendum is empty", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum={null}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
    expect(screen.getByText("Click to add notes...")).toBeInTheDocument()
  })

  it("exits edit mode on blur", async () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum="Some text"
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
    // Enter edit mode
    fireEvent.click(screen.getByTestId("notes-read-mode"))
    expect(screen.getByTestId("notes-input")).toBeInTheDocument()

    // Blur exits edit mode
    fireEvent.blur(screen.getByTestId("notes-input"))
    await waitFor(() => {
      expect(screen.queryByTestId("notes-input")).not.toBeInTheDocument()
      expect(screen.getByTestId("notes-read-mode")).toBeInTheDocument()
    })
  })
})
