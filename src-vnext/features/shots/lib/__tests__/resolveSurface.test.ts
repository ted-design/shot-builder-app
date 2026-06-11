import { describe, it, expect } from "vitest"
import {
  resolveSurface,
  type Affordances,
  type Chrome,
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
    // Test-helper default only — the PRODUCTION input field is required (a
    // missed call site is a type error, never a silent flag-off).
    shootSurfaceEnabled: false,
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

// ---------------------------------------------------------------------------
// Affordances / chrome — role × device × shootSurfaceEnabled matrix.
//
// FLAG OFF — the 5e-I characterization table (build spec §The API), pinned
// UNCHANGED: every value reproduces TODAY'S device gate at the consumer; the
// ONE named sub-delta is `export` keying to desktop (the 768-1023 tablet
// Export button dead-ends in RequireDesktop's toast+redirect today). Values
// are deliberately surface-INDEPENDENT flag-off — asserted across every role
// per device.
//
// FLAG ON — 5e-II value flips: every affordance drops its device term
// (consumers' role/global-claim terms still gate — presentation-only law)
// EXCEPT export, which keeps device==='desktop' (route constraint). Chrome
// reshapes for surface==='shoot' only (minimal toolbar, no view switcher,
// tap-row at every density); non-shoot surfaces keep today's chrome
// identically.
// ---------------------------------------------------------------------------

const EXPECTED_AFFORDANCES: Record<SurfaceDevice, Affordances> = {
  mobile: {
    fieldEditing: false,
    lifecycle: false,
    imageUpload: false,
    share: false,
    export: false,
    bulkPull: false,
    repair: false,
    versionRestore: false,
  },
  tablet: {
    fieldEditing: true,
    lifecycle: true,
    imageUpload: true,
    share: true,
    export: false, // the named sub-delta: tablet loses the dead-end Export button
    bulkPull: true,
    repair: true,
    versionRestore: true,
  },
  desktop: {
    fieldEditing: true,
    lifecycle: true,
    imageUpload: true,
    share: true,
    export: true,
    bulkPull: true,
    repair: true,
    versionRestore: true,
  },
}

const EXPECTED_CHROME: Record<SurfaceDevice, Chrome> = {
  mobile: { toolbar: "full", viewSwitcher: false, quickAdd: true, statusControl: "tap-row" },
  tablet: { toolbar: "full", viewSwitcher: true, quickAdd: true, statusControl: "badge-select" },
  desktop: { toolbar: "full", viewSwitcher: true, quickAdd: true, statusControl: "badge-select" },
}

/** Flag-ON affordances: device term dropped everywhere EXCEPT export. */
const EXPECTED_AFFORDANCES_FLAG_ON: Record<SurfaceDevice, Affordances> = {
  mobile: {
    fieldEditing: true,
    lifecycle: true,
    imageUpload: true,
    share: true,
    export: false, // desktop-keyed route constraint, flag-independent
    bulkPull: true,
    repair: true,
    versionRestore: true,
  },
  tablet: {
    fieldEditing: true,
    lifecycle: true,
    imageUpload: true,
    share: true,
    export: false,
    bulkPull: true,
    repair: true,
    versionRestore: true,
  },
  desktop: {
    fieldEditing: true,
    lifecycle: true,
    imageUpload: true,
    share: true,
    export: true,
    bulkPull: true,
    repair: true,
    versionRestore: true,
  },
}

/**
 * Flag-ON shoot-surface chrome — identical at EVERY density: the shell uses
 * the tap row on tablet/desktop too (Decision F's desktop-density covers
 * layout, not the control).
 */
const EXPECTED_SHOOT_CHROME_FLAG_ON: Chrome = {
  toolbar: "minimal",
  viewSwitcher: false,
  quickAdd: true,
  statusControl: "tap-row",
}

describe("resolveSurface — affordances/chrome role × device matrix, flag OFF (5e-I values pinned unchanged)", () => {
  for (const role of ROLES) {
    for (const device of DEVICES) {
      it(`role=${role} device=${device} shootSurfaceEnabled=false → today's device gates (export desktop-keyed)`, () => {
        const out = resolveSurface(input({ effectiveRole: role, device, shootSurfaceEnabled: false }))
        expect(out.affordances).toEqual(EXPECTED_AFFORDANCES[device])
        expect(out.chrome).toEqual(EXPECTED_CHROME[device])
      })
    }
  }

  it("derives from surface + device only: url/stored/group inputs never alter affordances or chrome", () => {
    for (const device of DEVICES) {
      const noisy = resolveSurface(
        input({ effectiveRole: "producer", device, urlView: "table", urlGroup: "status", storedView: "card" }),
      )
      expect(noisy.affordances).toEqual(EXPECTED_AFFORDANCES[device])
      expect(noisy.chrome).toEqual(EXPECTED_CHROME[device])
    }
  })
})

describe("resolveSurface — affordances/chrome role × device matrix, flag ON (5e-II value flips)", () => {
  for (const role of ROLES) {
    for (const device of DEVICES) {
      const isShoot = EXPECTED_SURFACE[role] === "shoot"
      it(`role=${role} device=${device} shootSurfaceEnabled=true → device term dropped (export desktop-keyed); ${isShoot ? "shoot chrome" : "chrome unchanged"}`, () => {
        const out = resolveSurface(input({ effectiveRole: role, device, shootSurfaceEnabled: true }))
        expect(out.affordances).toEqual(EXPECTED_AFFORDANCES_FLAG_ON[device])
        // Chrome reshapes ONLY for surface==='shoot'; every other surface
        // keeps today's device-based chrome byte-identical.
        expect(out.chrome).toEqual(isShoot ? EXPECTED_SHOOT_CHROME_FLAG_ON : EXPECTED_CHROME[device])
      })
    }
  }

  it("crew gets the tap-row status control at EVERY density under the flag (shell control, not layout)", () => {
    for (const device of DEVICES) {
      const out = resolveSurface(input({ effectiveRole: "crew", device, shootSurfaceEnabled: true }))
      expect(out.chrome.statusControl).toBe("tap-row")
      expect(out.chrome.toolbar).toBe("minimal")
      expect(out.chrome.viewSwitcher).toBe(false)
    }
  })

  it("plan-build keeps the device-based statusControl fork under the flag (non-shoot chrome unchanged)", () => {
    for (const role of ["admin", "producer"] as const) {
      expect(resolveSurface(input({ effectiveRole: role, device: "mobile", shootSurfaceEnabled: true })).chrome.statusControl).toBe("tap-row")
      expect(resolveSurface(input({ effectiveRole: role, device: "tablet", shootSurfaceEnabled: true })).chrome.statusControl).toBe("badge-select")
      expect(resolveSurface(input({ effectiveRole: role, device: "desktop", shootSurfaceEnabled: true })).chrome.statusControl).toBe("badge-select")
    }
  })

  it("export stays device==='desktop' under the flag (the route constraint is flag-independent)", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        const out = resolveSurface(input({ effectiveRole: role, device, shootSurfaceEnabled: true }))
        expect(out.affordances.export).toBe(device === "desktop")
      }
    }
  })

  it("never alters surface/viewMode/groupKey/viewSource: flag-on equals flag-off on every non-affordance/chrome output", () => {
    for (const role of ROLES) {
      for (const device of DEVICES) {
        for (const urlView of URL_VIEWS) {
          for (const urlGroup of URL_GROUPS) {
            for (const storedRaw of STORED_RAW) {
              const storedView = parseStoredRaw(storedRaw)
              const base = { effectiveRole: role, device, urlView, urlGroup, storedView }
              const off = resolveSurface(input({ ...base, shootSurfaceEnabled: false }))
              const on = resolveSurface(input({ ...base, shootSurfaceEnabled: true }))
              expect(on.surface).toBe(off.surface)
              expect(on.viewMode).toBe(off.viewMode)
              expect(on.groupKey).toBe(off.groupKey)
              expect(on.viewSource).toBe(off.viewSource)
            }
          }
        }
      }
    }
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
