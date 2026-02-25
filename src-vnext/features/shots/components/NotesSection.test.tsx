/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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

  it("keeps legacy notes read-only while showing one editable notes textarea", () => {
    render(
      <NotesSection
        notes="<p>Some notes</p>"
        notesAddendum={null}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
    const textareas = document.querySelectorAll("textarea")
    expect(textareas.length).toBe(1)
    expect(textareas[0]!.getAttribute("data-testid")).toBe("notes-input")
    expect(screen.getByText("Legacy Notes (Read-only)")).toBeInTheDocument()
  })

  it("prefills editable notes with existing content", () => {
    render(
      <NotesSection
        notes={null}
        notesAddendum={"Line one\nLine two"}
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )
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
})
