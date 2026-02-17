import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import { CallSheetRenderer } from "@/features/schedules/components/CallSheetRenderer"
import type { Schedule, Shot } from "@/shared/types"

function buildSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: "sched-1",
    projectId: "proj-1",
    name: "Day 1",
    date: Timestamp.fromMillis(Date.UTC(2026, 0, 1)),
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
    ...overrides,
  }
}

function buildShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Merino Overcoat",
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
    createdBy: "user-1",
    ...overrides,
  }
}

describe("CallSheetRenderer", () => {
  it("renders project name and schedule name in the header when provided", () => {
    render(
      <CallSheetRenderer
        projectName="Project Alpha"
        schedule={buildSchedule()}
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
        schedule={buildSchedule()}
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
          buildShot({ shotNumber: "A1" }),
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

  it("renders shot tags in schedule rows when enabled", () => {
    render(
      <CallSheetRenderer
        schedule={buildSchedule()}
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
          buildShot({
            tags: [{ id: "tag-1", label: "Outerwear", color: "blue" }],
          }),
        ]}
        talentCalls={[]}
        crewCalls={[]}
        talentLookup={[]}
        crewLookup={[]}
        config={{ sections: { header: false, schedule: true } }}
      />,
    )

    expect(screen.getByText("Outerwear")).toBeInTheDocument()
  })

  it("renders start time with compact duration on schedule rows", () => {
    render(
      <CallSheetRenderer
        schedule={buildSchedule()}
        dayDetails={null}
        entries={[
          {
            id: "entry-1",
            type: "shot",
            title: "Shot 1",
            shotId: "shot-1",
            startTime: "09:00",
            duration: 120,
            order: 0,
          },
        ]}
        shots={[buildShot()]}
        talentCalls={[]}
        crewCalls={[]}
        talentLookup={[]}
        crewLookup={[]}
        config={{ sections: { header: false, schedule: true } }}
      />,
    )

    expect(screen.getByText("9:00 AM")).toBeInTheDocument()
    expect(screen.getByText("2h")).toBeInTheDocument()
    expect(screen.queryByText("9:00 AM–11:00 AM")).not.toBeInTheDocument()
  })

  it("does not render track/applicability labels in advanced schedule output", () => {
    render(
      <CallSheetRenderer
        schedule={buildSchedule({
          tracks: [
            { id: "primary", name: "Photo Lane", order: 0 },
            { id: "track-2", name: "Video Lane", order: 1 },
          ],
        })}
        dayDetails={null}
        entries={[
          {
            id: "entry-1",
            type: "shot",
            title: "Shot 1",
            shotId: "shot-1",
            startTime: "09:00",
            duration: 40,
            trackId: "primary",
            order: 0,
          },
          {
            id: "entry-2",
            type: "shot",
            title: "Shot 2",
            shotId: "shot-2",
            startTime: "09:10",
            duration: 35,
            trackId: "track-2",
            order: 1,
          },
          {
            id: "entry-3",
            type: "banner",
            title: "Lunch",
            startTime: "12:00",
            duration: 30,
            trackId: "shared",
            appliesToTrackIds: ["primary", "track-2"],
            order: 2,
          },
        ]}
        shots={[
          buildShot({ id: "shot-1", title: "Shot One" }),
          buildShot({ id: "shot-2", title: "Shot Two" }),
        ]}
        talentCalls={[]}
        crewCalls={[]}
        talentLookup={[]}
        crewLookup={[]}
        config={{ sections: { header: false, schedule: true } }}
      />,
    )

    expect(screen.queryByText("Simultaneous")).not.toBeInTheDocument()
    expect(screen.queryByText(/Applies to:/i)).not.toBeInTheDocument()
    expect(screen.queryByText("9:00 AM–9:45 AM")).not.toBeInTheDocument()
    expect(screen.queryByText("Photo Lane")).not.toBeInTheDocument()
    expect(screen.queryByText("Video Lane")).not.toBeInTheDocument()
  })
})
