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
})

