import { describe, it, expect } from "vitest"
import {
  resolveSurface,
  type ResolveSurfaceInput,
  type SurfaceDevice,
  type SurfaceKind,
} from "../resolveSurface"
import type { ViewMode, GroupKey } from "../shotListFilters"
import { normalizeRole } from "@/shared/lib/rbac"
import type { Role } from "@/shared/types"

// ---------------------------------------------------------------------------
// resolveSurface unit matrix — Phase 4 build spec §Test plan item 2.
//
// Covers every (url × stored × role-default × device) combination, asserts
// provenance, pins the 'wardrobe' input, and proves flag-off equivalence:
// the resolver's output is byte-identical to the legacy inline ternaries
// (useShotListState pre-Phase-4 trunk) for EVERY combination except the one
// named, accepted behavior change — never-customized plan-build (admin/
// producer) users default to 'table' instead of 'card' off-mobile.
// ---------------------------------------------------------------------------

const ROLES: readonly Role[] = ["admin", "producer", "crew", "warehouse", "viewer"]
const DEVICES: readonly SurfaceDevice[] = ["mobile", "tablet", "desktop"]
const URL_VIEWS: readonly (string | null)[] = [null, "table", "card", "gallery", "visual", "bogus", ""]
const URL_GROUPS: readonly (string | null)[] = [null, "status", "date", "talent", "location", "scene", "bogus", ""]
/** RAW localStorage `:view:v1` values, as the hook would read them. */
const STORED_RAW: readonly (string | null)[] = [null, "card", "table", "gallery", "visual", "junk"]

const EXPECTED_SURFACE: Record<Role, SurfaceKind> = {
  admin: "plan-build",
  producer: "plan-build",
  crew: "shoot",
  warehouse: "review-warehouse",
  viewer: "review-client",
}

/**
 * Mirror of the hook's storedExplicitView mapping (raw localStorage value →
 * the resolver's `storedView` input). gallery/visual are legacy values that
 * migrated to card; anything else was never an explicit choice.
 */
function parseStoredRaw(raw: string | null): ViewMode | null {
  if (raw === "card" || raw === "gallery" || raw === "visual") return "card"
  return raw === "table" ? "table" : null
}

// ---------------------------------------------------------------------------
// Independent legacy oracle — a restatement of the pre-Phase-4 inline
// ternaries (useShotListState.ts:269-282 on trunk), NOT of resolveSurface.
// ---------------------------------------------------------------------------

function legacyViewMode(urlView: string | null, storedRaw: string | null, isMobile: boolean): ViewMode {
  const storedDefaultView: ViewMode =
    storedRaw === "gallery" || storedRaw === "visual"
      ? "card"
      : storedRaw === "table"
        ? "table"
        : "card"
  return isMobile
    ? "card"
    : urlView === "table"
      ? "table"
      : urlView === "card" || urlView === "gallery" || urlView === "visual"
        ? "card"
        : storedDefaultView
}

function legacyGroupKey(urlGroup: string | null, isMobile: boolean): GroupKey {
  return isMobile
    ? "none"
    : urlGroup === "status" || urlGroup === "date" || urlGroup === "talent" || urlGroup === "location" || urlGroup === "scene"
      ? (urlGroup as GroupKey)
      : "none"
}

function input(overrides: Partial<ResolveSurfaceInput>): ResolveSurfaceInput {
  return {
    effectiveRole: "viewer",
    device: "desktop",
    urlView: null,
    urlGroup: null,
    storedView: null,
    ...overrides,
  }
}

describe("resolveSurface — role → surface mapping", () => {
  it.each(ROLES)("maps %s to its surface", (role) => {
    expect(resolveSurface(input({ effectiveRole: role })).surface).toBe(EXPECTED_SURFACE[role])
  })

  it("pins the 'wardrobe' input: normalizeRole('wardrobe') feeds warehouse → review-warehouse", () => {
    const role = normalizeRole("wardrobe")
    expect(role).toBe("warehouse")
    const out = resolveSurface(input({ effectiveRole: role }))
    expect(out.surface).toBe("review-warehouse")
    // ...NOT the viewer surface the old alias ('wardrobe'→'viewer') landed on.
    expect(out.surface).not.toBe("review-client")
  })
})

describe("resolveSurface — full (url × stored × role-default × device) viewMode matrix", () => {
  for (const role of ROLES) {
    for (const device of DEVICES) {
      for (const urlView of URL_VIEWS) {
        for (const storedRaw of STORED_RAW) {
          const isMobile = device === "mobile"
          const storedView = parseStoredRaw(storedRaw)
          const legacy = legacyViewMode(urlView, storedRaw, isMobile)
          const isPlanBuild = role === "admin" || role === "producer"
          const neverCustomized = parseStoredRaw(storedRaw) === null
          const urlInert = urlView !== "table" && urlView !== "card" && urlView !== "gallery" && urlView !== "visual"
          // The ONLY accepted delta vs legacy: never-customized plan-build
          // users (no valid URL view, no stored choice) get table off-mobile.
          const expected: ViewMode =
            isPlanBuild && neverCustomized && urlInert && !isMobile ? "table" : legacy

          it(`role=${role} device=${device} url=${String(urlView)} stored=${String(storedRaw)} → ${expected}`, () => {
            const out = resolveSurface(input({ effectiveRole: role, device, urlView, storedView }))
            expect(out.viewMode).toBe(expected)
            // Flag-off equivalence for non-plan-build roles: byte-identical
            // to the legacy ternaries in EVERY combination.
            if (!isPlanBuild) expect(out.viewMode).toBe(legacy)
          })
        }
      }
    }
  }
})

describe("resolveSurface — groupKey matrix (URL-only persistence, mobile forcing)", () => {
  for (const device of DEVICES) {
    for (const urlGroup of URL_GROUPS) {
      const isMobile = device === "mobile"
      const expected = legacyGroupKey(urlGroup, isMobile)
      it(`device=${device} group=${String(urlGroup)} → ${expected} (legacy-equivalent for every role)`, () => {
        for (const role of ROLES) {
          expect(resolveSurface(input({ effectiveRole: role, device, urlGroup })).groupKey).toBe(expected)
        }
      })
    }
  }
})

describe("resolveSurface — provenance (viewSource)", () => {
  it("'url' when a valid ?view param wins (beats stored)", () => {
    const out = resolveSurface(input({ effectiveRole: "producer", urlView: "card", storedView: "table" }))
    expect(out.viewMode).toBe("card")
    expect(out.viewSource).toBe("url")
  })

  it("legacy URL aliases gallery/visual resolve as 'url' provenance card", () => {
    for (const alias of ["gallery", "visual"]) {
      const out = resolveSurface(input({ effectiveRole: "producer", urlView: alias }))
      expect(out.viewMode).toBe("card")
      expect(out.viewSource).toBe("url")
    }
  })

  it("'stored' when no URL param but an explicit prior choice exists", () => {
    const out = resolveSurface(input({ effectiveRole: "producer", storedView: "card" }))
    expect(out.viewMode).toBe("card") // producers who chose cards KEEP cards
    expect(out.viewSource).toBe("stored")
  })

  it("'surface-default' when neither URL nor stored choice exists", () => {
    const producer = resolveSurface(input({ effectiveRole: "producer" }))
    expect(producer.viewMode).toBe("table")
    expect(producer.viewSource).toBe("surface-default")
    const crew = resolveSurface(input({ effectiveRole: "crew" }))
    expect(crew.viewMode).toBe("card")
    expect(crew.viewSource).toBe("surface-default")
  })

  it("invalid ?view falls through to stored, then surface default", () => {
    expect(resolveSurface(input({ effectiveRole: "viewer", urlView: "bogus", storedView: "table" })).viewSource).toBe("stored")
    expect(resolveSurface(input({ effectiveRole: "viewer", urlView: "bogus" })).viewSource).toBe("surface-default")
  })

  it("'device-forced' when mobile forcing changes the outcome (view and/or group)", () => {
    const view = resolveSurface(input({ effectiveRole: "producer", device: "mobile", urlView: "table" }))
    expect(view.viewMode).toBe("card")
    expect(view.viewSource).toBe("device-forced")

    const group = resolveSurface(input({ effectiveRole: "viewer", device: "mobile", urlView: "card", urlGroup: "status" }))
    expect(group.groupKey).toBe("none")
    expect(group.viewSource).toBe("device-forced")
  })

  it("mobile keeps the underlying provenance when forcing changes nothing", () => {
    const out = resolveSurface(input({ effectiveRole: "viewer", device: "mobile", urlView: "card" }))
    expect(out.viewMode).toBe("card")
    expect(out.groupKey).toBe("none")
    expect(out.viewSource).toBe("url")
  })

  it("tablet is NOT forced — resolves like desktop", () => {
    const out = resolveSurface(input({ effectiveRole: "producer", device: "tablet", urlView: "table", urlGroup: "status" }))
    expect(out.viewMode).toBe("table")
    expect(out.groupKey).toBe("status")
    expect(out.viewSource).toBe("url")
  })
})

describe("resolveSurface — purity", () => {
  it("is pure: frozen input is not mutated and equal inputs give equal outputs", () => {
    const frozen = Object.freeze(input({ effectiveRole: "producer", device: "mobile", urlView: "table", urlGroup: "status", storedView: "card" }))
    const a = resolveSurface(frozen)
    const b = resolveSurface(input({ effectiveRole: "producer", device: "mobile", urlView: "table", urlGroup: "status", storedView: "card" }))
    expect(a).toEqual(b)
  })
})
