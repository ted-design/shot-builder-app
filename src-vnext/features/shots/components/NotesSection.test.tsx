/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
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

  it("saves edited notes with trimmed value", async () => {
    const user = userEvent.setup()
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
    await user.clear(textarea)
    await user.type(textarea, "  Updated text  ")
    await user.click(screen.getByTestId("notes-submit"))

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Updated text")
    })
  })

  it("disables save button until notes change", async () => {
    const user = userEvent.setup()
    render(
      <NotesSection
        notes={null}
        notesAddendum="Same"
        onSaveAddendum={() => Promise.resolve()}
        canEditAddendum={true}
      />,
    )

    const button = screen.getByTestId("notes-submit")
    expect(button).toBeDisabled()

    const textarea = screen.getByTestId("notes-input")
    await user.type(textarea, " plus")
    expect(button).not.toBeDisabled()
  })

  it("retains draft text when notes save fails", async () => {
    const user = userEvent.setup()
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
    await user.clear(textarea)
    await user.type(textarea, "Important note")
    await user.click(screen.getByTestId("notes-submit"))

    await waitFor(() => {
      expect(textarea.value).toBe("Important note")
    })
    expect(onSave).toHaveBeenCalledWith("Important note")
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
