import { describe, it, expect } from "vitest"
import type { ShotFirestoreStatus } from "@/shared/types"
import {
  computeNextAction,
  CASTING_LOCK_WINDOW_DAYS,
  type NextActionInput,
} from "../computeNextAction"

const NOW = new Date("2026-06-03T12:00:00Z")
const PROJECT_ID = "proj-1"

function shotCounts(
  overrides: Partial<Record<ShotFirestoreStatus, number>> = {},
): Record<ShotFirestoreStatus, number> {
  return { todo: 0, in_progress: 0, on_hold: 0, complete: 0, ...overrides }
}

/** A fully-ready project: nothing actionable. Override to trigger one branch. */
function makeInput(overrides: Partial<NextActionInput> = {}): NextActionInput {
  return {
    projectId: PROJECT_ID,
    shotCounts: shotCounts({ complete: 10 }),
    casting: { unbooked: 0 },
    samples: { missing: 0 },
    schedule: { hasCallSheet: true, sent: true },
    shootDate: new Date("2026-06-09T00:00:00Z"),
    ...overrides,
  }
}

/** A date `days` whole days after NOW. */
function shootIn(days: number): Date {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000)
}

describe("computeNextAction", () => {
  describe("branch 1: unbooked-casting-near-shoot", () => {
    it("flags unbooked casting when the shoot is inside the lock window", () => {
      const result = computeNextAction(
        makeInput({ casting: { unbooked: 4 }, shootDate: shootIn(6) }),
        NOW,
      )
      expect(result?.label).toBe("unbooked-casting-near-shoot")
      expect(result?.ctaText).toBe("Open Casting")
      expect(result?.ctaTo).toBe(`/projects/${PROJECT_ID}/casting`)
      expect(result?.message).toContain("4 roles unbooked")
      expect(result?.message).toContain("6 days")
    })

    it("singularizes role/day copy when one role and one day remain", () => {
      const result = computeNextAction(
        makeInput({ casting: { unbooked: 1 }, shootDate: shootIn(1) }),
        NOW,
      )
      expect(result?.label).toBe("unbooked-casting-near-shoot")
      expect(result?.message).toContain("1 role unbooked")
      expect(result?.message).toContain("1 day to go")
    })

    it("fires exactly on the lock-window boundary", () => {
      const result = computeNextAction(
        makeInput({
          casting: { unbooked: 2 },
          shootDate: shootIn(CASTING_LOCK_WINDOW_DAYS),
        }),
        NOW,
      )
      expect(result?.label).toBe("unbooked-casting-near-shoot")
    })

    it("does NOT flag casting when the shoot is beyond the lock window", () => {
      const result = computeNextAction(
        makeInput({
          casting: { unbooked: 4 },
          shootDate: shootIn(CASTING_LOCK_WINDOW_DAYS + 1),
          // keep everything else ready so casting is the only candidate
          samples: { missing: 0 },
          schedule: { hasCallSheet: true, sent: true },
          shotCounts: shotCounts({ complete: 5 }),
        }),
        NOW,
      )
      expect(result).toBeNull()
    })

    it("does NOT flag casting when there is no shoot date", () => {
      const result = computeNextAction(
        makeInput({ casting: { unbooked: 4 }, shootDate: null }),
        NOW,
      )
      expect(result).toBeNull()
    })

    it("does NOT flag casting once the shoot date has passed", () => {
      const result = computeNextAction(
        makeInput({ casting: { unbooked: 4 }, shootDate: shootIn(-1) }),
        NOW,
      )
      expect(result).toBeNull()
    })
  })

  describe("branch 2: missing-samples", () => {
    it("flags missing samples", () => {
      const result = computeNextAction(
        makeInput({ samples: { missing: 8 } }),
        NOW,
      )
      expect(result?.label).toBe("missing-samples")
      expect(result?.ctaText).toBe("Open Pulls")
      expect(result?.ctaTo).toBe(`/projects/${PROJECT_ID}/pulls`)
      expect(result?.message).toContain("8 samples")
      expect(result?.message).toContain("haven't")
    })

    it("singularizes copy for a single missing sample", () => {
      const result = computeNextAction(
        makeInput({ samples: { missing: 1 } }),
        NOW,
      )
      expect(result?.message).toContain("1 sample still hasn't arrived")
    })
  })

  describe("branch 3: unsent-callsheet", () => {
    it("flags a draft (unsent) call sheet that exists", () => {
      const result = computeNextAction(
        makeInput({ schedule: { hasCallSheet: true, sent: false } }),
        NOW,
      )
      expect(result?.label).toBe("unsent-callsheet")
      expect(result?.ctaText).toBe("Open Call Sheet")
      expect(result?.ctaTo).toBe(`/projects/${PROJECT_ID}/callsheet`)
      expect(result?.message).toContain("still a draft")
    })

    it("flags a missing call sheet entirely", () => {
      const result = computeNextAction(
        makeInput({ schedule: { hasCallSheet: false, sent: false } }),
        NOW,
      )
      expect(result?.label).toBe("unsent-callsheet")
      expect(result?.ctaText).toBe("Build Call Sheet")
      expect(result?.message).toContain("No call sheet yet")
    })
  })

  describe("branch 4: build-shot-list", () => {
    it("flags an empty shot list when nothing else is pending", () => {
      const result = computeNextAction(
        makeInput({ shotCounts: shotCounts() }),
        NOW,
      )
      expect(result?.label).toBe("build-shot-list")
      expect(result?.ctaText).toBe("Build Shot List")
      expect(result?.ctaTo).toBe(`/projects/${PROJECT_ID}/shots`)
      expect(result?.message).toContain("no shots yet")
    })

    it("counts shots across every status (non-empty => no build prompt)", () => {
      const result = computeNextAction(
        makeInput({ shotCounts: shotCounts({ on_hold: 1 }) }),
        NOW,
      )
      expect(result).toBeNull()
    })
  })

  describe("null case", () => {
    it("returns null when nothing is actionable", () => {
      expect(computeNextAction(makeInput(), NOW)).toBeNull()
    })
  })

  describe("priority ordering", () => {
    it("casting outranks samples, call sheet, and empty shot list", () => {
      const result = computeNextAction(
        makeInput({
          casting: { unbooked: 3 },
          shootDate: shootIn(5),
          samples: { missing: 5 },
          schedule: { hasCallSheet: false, sent: false },
          shotCounts: shotCounts(),
        }),
        NOW,
      )
      expect(result?.label).toBe("unbooked-casting-near-shoot")
    })

    it("samples outrank call sheet and empty shot list", () => {
      const result = computeNextAction(
        makeInput({
          casting: { unbooked: 0 },
          samples: { missing: 2 },
          schedule: { hasCallSheet: false, sent: false },
          shotCounts: shotCounts(),
        }),
        NOW,
      )
      expect(result?.label).toBe("missing-samples")
    })

    it("call sheet outranks empty shot list", () => {
      const result = computeNextAction(
        makeInput({
          casting: { unbooked: 0 },
          samples: { missing: 0 },
          schedule: { hasCallSheet: true, sent: false },
          shotCounts: shotCounts(),
        }),
        NOW,
      )
      expect(result?.label).toBe("unsent-callsheet")
    })
  })
})
