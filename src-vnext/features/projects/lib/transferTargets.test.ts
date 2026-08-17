import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { Project } from "@/shared/types"
import { filterEligibleTransferTargets, isEligibleTransferTarget } from "./transferTargets"

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Project",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "active",
    shootDates: overrides.shootDates ?? [],
    deletedAt: overrides.deletedAt,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe("isEligibleTransferTarget", () => {
  it("excludes the current project by id", () => {
    expect(isEligibleTransferTarget(makeProject({ id: "p1" }), "p1")).toBe(false)
  })

  it("excludes archived projects", () => {
    expect(isEligibleTransferTarget(makeProject({ id: "p2", status: "archived" }), "p1")).toBe(false)
  })

  it("excludes soft-deleted projects (deletedAt set)", () => {
    expect(isEligibleTransferTarget(makeProject({ id: "p2", deletedAt: "2026-01-01" }), "p1")).toBe(false)
  })

  it("includes an active, non-deleted, different project", () => {
    expect(isEligibleTransferTarget(makeProject({ id: "p2", status: "active" }), "p1")).toBe(true)
  })

  it("includes a completed (non-archived) different project", () => {
    expect(isEligibleTransferTarget(makeProject({ id: "p2", status: "completed" }), "p1")).toBe(true)
  })
})

describe("filterEligibleTransferTargets", () => {
  it("filters a mixed list down to eligible targets only", () => {
    const projects = [
      makeProject({ id: "current", status: "active" }),
      makeProject({ id: "archived-1", status: "archived" }),
      makeProject({ id: "deleted-1", status: "active", deletedAt: "2026-01-01" }),
      makeProject({ id: "eligible-1", status: "active" }),
      makeProject({ id: "eligible-2", status: "completed" }),
    ]
    const result = filterEligibleTransferTargets(projects, "current")
    expect(result.map((p) => p.id)).toEqual(["eligible-1", "eligible-2"])
  })
})
