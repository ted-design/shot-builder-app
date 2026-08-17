/// <reference types="@testing-library/jest-dom" />
// 0.5 — th scope="col" (Phase 0 build plan, G4 A4).
//
// Every <th> in ShotsTable's <thead> — the resizable column headers (via the
// shared ResizableHeader) and the static headers (drag handle, selection,
// lifecycle actions, status) — must carry scope="col" for screen-reader table
// navigation. Renders with an empty shots array so the <tbody> never mounts a
// row (no ShotStatusSelect / AuthProvider dependency needed to exercise the
// header row this fix touches).
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ShotsTable } from "../ShotsTable"

describe("ShotsTable th scope=col", () => {
  it("every rendered <th> (resizable columns + static headers) has scope=\"col\"", () => {
    const { container } = render(
      <ShotsTable
        clientId="c1"
        projectId="p1"
        shots={[]}
        onOpenShot={() => {}}
        reorderEnabled
        showLifecycleActions
        selection={{
          enabled: true,
          selectedIds: new Set(),
          onToggle: () => {},
          onToggleAll: () => {},
        }}
      />,
    )

    const allHeaders = container.querySelectorAll("thead th")
    const scopedHeaders = container.querySelectorAll("thead th[scope='col']")

    // Sanity: this fixture actually exercises every static header branch —
    // drag column (reorderEnabled) + selection + N visible columns +
    // lifecycle actions + the always-on status column.
    expect(allHeaders.length).toBeGreaterThanOrEqual(5)
    expect(scopedHeaders.length).toBe(allHeaders.length)
  })
})
