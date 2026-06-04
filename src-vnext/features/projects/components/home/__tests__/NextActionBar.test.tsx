/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { NextActionBar } from "@/features/projects/components/home/NextActionBar"
import type { NextAction } from "@/features/projects/components/home/lib/computeNextAction"

const sampleAction: NextAction = {
  label: "unbooked-casting-near-shoot",
  message:
    "Casting still has 4 roles unbooked with 6 days to go. Lock talent so wardrobe and the call sheet can finalize.",
  ctaText: "Open Casting",
  ctaTo: "/projects/p1/casting",
}

function renderBar(action: NextAction | null) {
  return render(
    <MemoryRouter>
      <NextActionBar action={action} />
    </MemoryRouter>,
  )
}

describe("NextActionBar", () => {
  it("renders nothing when action is null", () => {
    const { container } = renderBar(null)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId("next-action-bar")).not.toBeInTheDocument()
  })

  it("renders the message and the 'Do this next' label", () => {
    renderBar(sampleAction)
    expect(screen.getByTestId("next-action-bar")).toBeInTheDocument()
    expect(screen.getByText(/do this next/i)).toBeInTheDocument()
    expect(screen.getByText(sampleAction.message)).toBeInTheDocument()
  })

  it("renders the CTA as a router link to ctaTo with ctaText", () => {
    renderBar(sampleAction)
    const cta = screen.getByTestId("next-action-cta")
    expect(cta).toHaveTextContent("Open Casting")
    expect(cta).toHaveAttribute("href", "/projects/p1/casting")
  })

  it("uses the ctaTo/ctaText from the supplied action (build-shot-list branch)", () => {
    renderBar({
      label: "build-shot-list",
      message: "This project has no shots yet. Build the shot list to start planning the shoot.",
      ctaText: "Build Shot List",
      ctaTo: "/projects/abc/shots",
    })
    const cta = screen.getByTestId("next-action-cta")
    expect(cta).toHaveTextContent("Build Shot List")
    expect(cta).toHaveAttribute("href", "/projects/abc/shots")
  })
})
