/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { BriefCard } from "@/features/projects/components/home/BriefCard"

function renderCard(props: Parameters<typeof BriefCard>[0]) {
  return render(
    <MemoryRouter>
      <BriefCard {...props} />
    </MemoryRouter>,
  )
}

describe("BriefCard", () => {
  it("renders the brief link with host label when briefUrl is set", () => {
    renderCard({ briefUrl: "https://www.drive.google.com/file/abc" })

    const link = screen.getByRole("link", { name: /open brief/i })
    expect(link).toHaveAttribute("href", "https://www.drive.google.com/file/abc")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    // host label strips the leading www.
    expect(screen.getByText("drive.google.com")).toBeInTheDocument()
  })

  it("renders a notes preview (HTML stripped) when notes are set", () => {
    renderCard({ notes: "<p>Quiet, considered, <b>travel-ready</b> today.</p>" })

    // textPreview strips tags and collapses whitespace
    expect(screen.getByText("Quiet, considered, travel-ready today.")).toBeInTheDocument()
    // no brief link when there is no URL
    expect(screen.queryByRole("link", { name: /open brief/i })).not.toBeInTheDocument()
  })

  it("truncates a long notes preview to notesMaxLength", () => {
    const longNotes = "word ".repeat(100)
    renderCard({ notes: longNotes, notesMaxLength: 20 })

    const para = screen.getByText(/word/)
    // 20 chars + ellipsis (the … char)
    expect(para.textContent?.length).toBeLessThanOrEqual(21)
    expect(para.textContent).toContain("…")
  })

  it("renders both the link and the notes preview when both are present", () => {
    renderCard({
      briefUrl: "https://example.com/brief",
      notes: "Spring merino drop across five core styles.",
    })

    expect(screen.getByRole("link", { name: /open brief/i })).toBeInTheDocument()
    expect(
      screen.getByText("Spring merino drop across five core styles."),
    ).toBeInTheDocument()
    expect(screen.getByText("example.com")).toBeInTheDocument()
  })

  it("shows an empty state when neither briefUrl nor notes are provided", () => {
    renderCard({})

    expect(screen.getByText(/no brief yet/i)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /open brief/i })).not.toBeInTheDocument()
  })

  it("treats whitespace-only briefUrl/notes as empty", () => {
    renderCard({ briefUrl: "   ", notes: "   " })

    expect(screen.getByText(/no brief yet/i)).toBeInTheDocument()
  })

  it("omits the host label when briefUrl is unparseable but still shows the link", () => {
    renderCard({ briefUrl: "not-a-valid-url" })

    expect(screen.getByRole("link", { name: /open brief/i })).toBeInTheDocument()
    // getBriefHost returns "" for unparseable input → no host paragraph
    expect(screen.queryByText("not-a-valid-url")).not.toBeInTheDocument()
  })
})
