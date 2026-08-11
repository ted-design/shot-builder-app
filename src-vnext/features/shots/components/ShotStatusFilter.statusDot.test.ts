import { describe, expect, it } from "vitest"
import { STATUS_DOT_CLASS } from "./ShotStatusFilter"
import { SHOT_STATUS_CYCLE, getShotStatusColor } from "@/shared/lib/statusMappings"

// STATUS_DOT_CLASS is a hand-written exhaustive literal (see the comment on
// its declaration for why it isn't derived via template-literal
// interpolation off getShotStatusColor — Tailwind's static scanner can't see
// an interpolated class token). This test is the only thing that keeps the
// two in sync: it fails the moment a status's dot color diverges from
// getShotStatusColor, and it fails if a status is ever missing from the map.
describe("ShotStatusFilter STATUS_DOT_CLASS mirrors getShotStatusColor", () => {
  it("has an entry for every status in the cycle, matching the canonical color", () => {
    for (const status of SHOT_STATUS_CYCLE) {
      const expectedColor = getShotStatusColor(status)
      expect(STATUS_DOT_CLASS[status]).toBe(`bg-[var(--color-status-${expectedColor}-text)]`)
    }
  })

  it("covers exactly the four known shot statuses", () => {
    expect(Object.keys(STATUS_DOT_CLASS).sort()).toEqual(
      ["complete", "in_progress", "on_hold", "todo"].sort(),
    )
  })
})
