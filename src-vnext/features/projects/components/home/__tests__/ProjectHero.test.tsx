/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Project } from "@/shared/types"
import {
  ProjectHero,
  type ProjectHeroCountdown,
} from "@/features/projects/components/home/ProjectHero"

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Q2-26 No. 3",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "active",
    shootDates: overrides.shootDates ?? [],
    notes: overrides.notes,
    briefUrl: overrides.briefUrl,
    deletedAt: overrides.deletedAt,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

const countdown: ProjectHeroCountdown = {
  days: 6,
  dateLabel: "Tuesday, June 9",
  callTime: "07:30",
}

function renderHero(props: Partial<React.ComponentProps<typeof ProjectHero>> = {}) {
  return render(
    <MemoryRouter>
      <ProjectHero
        project={props.project ?? makeProject()}
        countdown={props.countdown === undefined ? countdown : props.countdown}
        eyebrow={props.eyebrow}
        tagline={props.tagline}
        briefLabel={props.briefLabel}
      />
    </MemoryRouter>,
  )
}

describe("ProjectHero", () => {
  it("renders the project title and status pill", () => {
    renderHero({ project: makeProject({ name: "Q2-26 No. 3", status: "active" }) })
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Q2-26 No. 3")
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("renders the eyebrow when provided", () => {
    renderHero({ eyebrow: "Unbound Merino · Ecommerce + Lifestyle" })
    expect(
      screen.getByText("Unbound Merino · Ecommerce + Lifestyle"),
    ).toBeInTheDocument()
  })

  it("renders the explicit tagline over notes", () => {
    renderHero({
      project: makeProject({ notes: "from notes" }),
      tagline: "Spring merino drop story",
    })
    expect(screen.getByTestId("project-hero-tagline")).toHaveTextContent(
      "Spring merino drop story",
    )
  })

  it("derives the tagline from project.notes when none is passed", () => {
    renderHero({ project: makeProject({ notes: "<p>Quiet, considered, travel-ready.</p>" }) })
    expect(screen.getByTestId("project-hero-tagline")).toHaveTextContent(
      "Quiet, considered, travel-ready.",
    )
  })

  it("renders the brief chip with host when briefUrl is set", () => {
    renderHero({
      project: makeProject({ briefUrl: "https://drive.google.com/abc" }),
      briefLabel: "UM Spring '26 · No. 3",
    })
    const chip = screen.getByTestId("project-hero-brief")
    expect(chip).toHaveTextContent("UM Spring '26 · No. 3")
    expect(chip).toHaveTextContent("drive.google.com")
    expect(chip).toHaveAttribute("href", "https://drive.google.com/abc")
  })

  it("omits the brief chip when no briefUrl", () => {
    renderHero({ project: makeProject({ briefUrl: undefined }) })
    expect(screen.queryByTestId("project-hero-brief")).not.toBeInTheDocument()
  })

  it("omits the brief chip for a javascript: URL (XSS guard)", () => {
    renderHero({ project: makeProject({ briefUrl: "javascript:alert(1)" }) })
    expect(screen.queryByTestId("project-hero-brief")).not.toBeInTheDocument()
  })

  it("renders the countdown with days, label, date and call time", () => {
    renderHero({ countdown })
    const block = screen.getByTestId("project-hero-countdown")
    expect(block).toHaveTextContent("6")
    expect(block).toHaveTextContent("Days to shoot")
    expect(block).toHaveTextContent("Tuesday, June 9")
    expect(block).toHaveTextContent("Call 07:30")
  })

  it("singularizes the countdown label at one day and omits absent call time", () => {
    renderHero({ countdown: { days: 1, dateLabel: "Tomorrow" } })
    const block = screen.getByTestId("project-hero-countdown")
    expect(block).toHaveTextContent("Day to shoot")
    expect(block).not.toHaveTextContent("Call")
  })

  it("omits the countdown column when countdown is null", () => {
    renderHero({ countdown: null })
    expect(screen.queryByTestId("project-hero-countdown")).not.toBeInTheDocument()
  })
})
