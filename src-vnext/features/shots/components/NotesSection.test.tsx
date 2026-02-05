/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NotesSection } from "./NotesSection"

describe("NotesSection", () => {
  describe("read-only HTML notes", () => {
    it("renders sanitized HTML content", () => {
      render(
        <NotesSection
          notes="<p>Legacy <strong>formatted</strong> notes</p>"
          notesAddendum={null}
          onAppendAddendum={() => Promise.resolve()}
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
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={false}
        />,
      )
      expect(screen.getByText("No notes")).toBeInTheDocument()
    })

    it("does not render a textarea for notes (no write path for legacy notes)", () => {
      render(
        <NotesSection
          notes="<p>Some notes</p>"
          notesAddendum={null}
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={true}
        />,
      )
      const textareas = document.querySelectorAll("textarea")
      expect(textareas.length).toBe(1)
      expect(textareas[0]!.getAttribute("data-testid")).toBe("addendum-input")
    })
  })

  describe("append-only addendum", () => {
    it("displays existing addendum as read-only text", () => {
      render(
        <NotesSection
          notes={null}
          notesAddendum="Existing addendum content"
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={true}
        />,
      )
      const addendumText = screen.getByText("Existing addendum content")
      expect(addendumText).toBeInTheDocument()
      expect(addendumText.tagName).toBe("P")
    })

    it("shows append input and button when canEditAddendum is true", () => {
      render(
        <NotesSection
          notes={null}
          notesAddendum={null}
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={true}
        />,
      )
      expect(screen.getByTestId("addendum-input")).toBeInTheDocument()
      expect(screen.getByTestId("addendum-submit")).toBeInTheDocument()
    })

    it("does not show append controls when canEditAddendum is false", () => {
      render(
        <NotesSection
          notes={null}
          notesAddendum="Some text"
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={false}
        />,
      )
      expect(screen.queryByTestId("addendum-input")).not.toBeInTheDocument()
      expect(screen.queryByTestId("addendum-submit")).not.toBeInTheDocument()
    })

    it("calls onAppendAddendum with trimmed new entry on submit", async () => {
      const user = userEvent.setup()
      const onAppend = vi.fn().mockResolvedValue(undefined)
      render(
        <NotesSection
          notes={null}
          notesAddendum="Prior entry"
          onAppendAddendum={onAppend}
          canEditAddendum={true}
        />,
      )

      await user.type(screen.getByTestId("addendum-input"), "  New entry  ")
      await user.click(screen.getByTestId("addendum-submit"))

      await waitFor(() => {
        expect(onAppend).toHaveBeenCalledWith("New entry")
      })
    })

    it("clears the input after successful append", async () => {
      const user = userEvent.setup()
      const onAppend = vi.fn().mockResolvedValue(undefined)
      render(
        <NotesSection
          notes={null}
          notesAddendum={null}
          onAppendAddendum={onAppend}
          canEditAddendum={true}
        />,
      )

      const textarea = screen.getByTestId("addendum-input") as HTMLTextAreaElement
      await user.type(textarea, "New entry")
      await user.click(screen.getByTestId("addendum-submit"))

      await waitFor(() => {
        expect(textarea.value).toBe("")
      })
    })

    it("retains input text when append fails", async () => {
      const user = userEvent.setup()
      const onAppend = vi.fn().mockRejectedValue(new Error("Firestore write failed"))
      render(
        <NotesSection
          notes={null}
          notesAddendum="Existing"
          onAppendAddendum={onAppend}
          canEditAddendum={true}
        />,
      )

      const textarea = screen.getByTestId("addendum-input") as HTMLTextAreaElement
      await user.type(textarea, "Important note")
      await user.click(screen.getByTestId("addendum-submit"))

      await waitFor(() => {
        expect(textarea.value).toBe("Important note")
      })
      expect(onAppend).toHaveBeenCalledWith("Important note")
    })

    it("does not call onAppendAddendum when input is empty or whitespace", () => {
      const onAppend = vi.fn()
      render(
        <NotesSection
          notes={null}
          notesAddendum={null}
          onAppendAddendum={onAppend}
          canEditAddendum={true}
        />,
      )

      const button = screen.getByTestId("addendum-submit")
      expect(button).toBeDisabled()

      fireEvent.change(screen.getByTestId("addendum-input"), {
        target: { value: "   " },
      })
      expect(button).toBeDisabled()
    })

    it("shows empty state when no addendum exists", () => {
      render(
        <NotesSection
          notes={null}
          notesAddendum={null}
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={false}
        />,
      )
      expect(screen.getByText("No addendum yet")).toBeInTheDocument()
    })

    it("preserves whitespace formatting in existing addendum", () => {
      render(
        <NotesSection
          notes={null}
          notesAddendum={"Line one\n\nLine two"}
          onAppendAddendum={() => Promise.resolve()}
          canEditAddendum={false}
        />,
      )
      const el = screen.getByText(/Line one/)
      expect(el.textContent).toContain("Line one")
      expect(el.textContent).toContain("Line two")
      expect(el.className).toContain("whitespace-pre-wrap")
    })
  })
})
