import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import { CallSheetRenderer } from "@/features/schedules/components/CallSheetRenderer"

describe("CallSheetRenderer", () => {
  it("renders project name and schedule name in the header when provided", () => {
    render(
      <CallSheetRenderer
        projectName="Project Alpha"
        schedule={{
          id: "sched-1",
          projectId: "proj-1",
          name: "Day 1",
          date: Timestamp.fromMillis(Date.UTC(2026, 0, 1)),
          createdAt: Timestamp.fromMillis(0),
          updatedAt: Timestamp.fromMillis(0),
        }}
        dayDetails={null}
        entries={[]}
        shots={[]}
        talentCalls={[]}
        crewCalls={[]}
        talentLookup={[]}
        crewLookup={[]}
        config={{ sections: { header: true } }}
      />,
    )

    expect(screen.getByText("Project Alpha")).toBeInTheDocument()
    expect(screen.getByText("Day 1")).toBeInTheDocument()
  })

  it("applies accent color config to renderer accent labels", () => {
    const { container } = render(
      <CallSheetRenderer
        schedule={{
          id: "sched-1",
          projectId: "proj-1",
          name: "Day 1",
          date: Timestamp.fromMillis(Date.UTC(2026, 0, 1)),
          createdAt: Timestamp.fromMillis(0),
          updatedAt: Timestamp.fromMillis(0),
        }}
        dayDetails={null}
        entries={[
          {
            id: "entry-1",
            type: "shot",
            title: "Shot 1",
            shotId: "shot-1",
            startTime: "09:00",
            order: 0,
          },
        ]}
        shots={[
          {
            id: "shot-1",
            title: "Merino Overcoat",
            projectId: "proj-1",
            clientId: "client-1",
            status: "todo",
            talent: [],
            products: [],
            sortOrder: 0,
            shotNumber: "A1",
            createdAt: Timestamp.fromMillis(0),
            updatedAt: Timestamp.fromMillis(0),
            createdBy: "user-1",
          },
        ]}
        talentCalls={[]}
        crewCalls={[]}
        talentLookup={[]}
        crewLookup={[]}
        config={{
          sections: { header: false, schedule: true },
          colors: { accent: "#10b981" },
        }}
      />,
    )

    const root = container.firstElementChild as HTMLElement
    expect(root.style.getPropertyValue("--doc-accent")).toBe("#10b981")
    expect(screen.getByText("A1")).toHaveStyle("color: var(--doc-accent,#2563eb)")
  })
})
