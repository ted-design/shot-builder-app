import type { Role } from "@/shared/types"
import type { ViewMode, GroupKey } from "@/features/shots/lib/shotListFilters"

// PURE function, all inputs explicit — output is presentation-only by construction; no write
// handler may consume it. `effectiveRole` is the typed preview slot: callers pass an already-
// resolved role (5b upgrades the source; a future View-as feeds a simulated role here).

export type SurfaceDevice = "mobile" | "tablet" | "desktop"

/** Distinct review variants now — 5f splits client vs warehouse without an enum break. */
export type SurfaceKind = "plan-build" | "shoot" | "review-client" | "review-warehouse"

/** Provenance of the resolved viewMode/groupKey. */
export type ViewSource = "url" | "stored" | "surface-default" | "device-forced"

// columns deliberately absent: nothing consumes it before Phase 6 (CLAUDE.md no-stubs rule).

/**
 * Presentation-only by construction (header law carries verbatim): each field
 * replaces ONLY the device term of an existing consumer gate — the rbac/
 * global-claim term stays at the consumer. No can-* or write handler may
 * consume these as a role source.
 */
export interface Affordances {
  /** → ShotDetailPageUnified canEdit's !isMobile term. */
  readonly fieldEditing: boolean
  /** → ShotDetailPageUnified + ShotListPage canManageLifecycle device terms. */
  readonly lifecycle: boolean
  /** → ShotDetailPageUnified canUploadShotImages device term ONLY — role term stays GLOBAL-pinned. */
  readonly imageUpload: boolean
  /** → ShotDetailPageUnified's inline share !isMobile — role term stays global-pinned. */
  readonly share: boolean
  /** → ShotDetailPageUnified canExport + ShotListPage canExport — stays ROLE-FREE (locked). */
  readonly export: boolean
  /** → ShotListPage canBulkPull device term. */
  readonly bulkPull: boolean
  /** → ShotListPage canRepair device term. */
  readonly repair: boolean
  /** → ShotVersionHistorySection's INTERNAL isMobile kill-switch (own hook, outside the page capability block). */
  readonly versionRestore: boolean
}

/** Shell chrome decisions — same presentation-only law as Affordances. */
export interface Chrome {
  /** → ShotListToolbar mount in ShotListPage. */
  readonly toolbar: "full" | "minimal" | "none"
  /** → ShotListToolbar card/table toggle. */
  readonly viewSwitcher: boolean
  /** → showCreate button + the FAB ?create=1 consume path in ShotListPage. */
  readonly quickAdd: boolean
  /** → the desktop-select-vs-mobile-tap-row fork in ShotDetailPageUnified. */
  readonly statusControl: "tap-row" | "badge-select"
}

export interface ResolveSurfaceInput {
  /** Already-resolved role. Opaque — see header comment (5b upgrades source). */
  readonly effectiveRole: Role
  /** Real device. Three-valued — a boolean would break 5e (tablet chrome). */
  readonly device: SurfaceDevice
  /** Raw `view` URL param (unvalidated). */
  readonly urlView: string | null
  /** Raw `group` URL param (unvalidated). */
  readonly urlGroup: string | null
  /** Prior EXPLICIT choice from localStorage `:view:v1`, null if never set. */
  readonly storedView: ViewMode | null
  /**
   * 5e-II — `featureShootSurface` flag value, passed EXPLICITLY by every
   * caller (required, no default: a missed call site is a type error, not a
   * silent flag-off). false → byte-identical 5e-I values; true → the flag-on
   * affordances/chrome table below. surface/viewMode/groupKey/viewSource are
   * NEVER affected by this input.
   */
  readonly shootSurfaceEnabled: boolean
}

export interface ResolvedSurface {
  readonly surface: SurfaceKind
  readonly viewMode: ViewMode
  readonly groupKey: GroupKey
  readonly viewSource: ViewSource
  readonly affordances: Affordances
  readonly chrome: Chrome
}

// ---------------------------------------------------------------------------
// Role → surface mapping (the "job" each role lands on)
// ---------------------------------------------------------------------------

const SURFACE_BY_ROLE: Record<Role, SurfaceKind> = {
  admin: "plan-build",
  producer: "plan-build",
  crew: "shoot",
  warehouse: "review-warehouse",
  viewer: "review-client",
}

/**
 * Surface default viewMode (the lowest-precedence rung). Only plan-build
 * changes today's hard default ('card'): producers/admins who never
 * customized get the table; everyone else resolves byte-identical to the
 * legacy ternaries — flag-on is VISUALLY INERT for crew/warehouse/viewer.
 */
const DEFAULT_VIEW_BY_SURFACE: Record<SurfaceKind, ViewMode> = {
  "plan-build": "table",
  shoot: "card",
  "review-client": "card",
  "review-warehouse": "card",
}

// ---------------------------------------------------------------------------
// Param validation (mirrors the legacy inline ternaries in useShotListState)
// ---------------------------------------------------------------------------

function parseUrlView(urlView: string | null): ViewMode | null {
  if (urlView === "table") return "table"
  // Backward compat: "gallery" and "visual" URL params map to "card"
  if (urlView === "card" || urlView === "gallery" || urlView === "visual") return "card"
  return null
}

function parseUrlGroup(urlGroup: string | null): GroupKey {
  return urlGroup === "status" ||
    urlGroup === "date" ||
    urlGroup === "talent" ||
    urlGroup === "location" ||
    urlGroup === "scene"
    ? urlGroup
    : "none"
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

/**
 * Precedence (pinned, spec §Resolution precedence):
 *   URL param > stored explicit choice > surface/role default
 * with device forcing (mobile → card/none) applied LAST as a NON-DESTRUCTIVE
 * derivation: latent ?view=table&group=status survive untouched and restore
 * on resize across 768px. groupKey keeps URL-only persistence.
 */
export function resolveSurface(input: ResolveSurfaceInput): ResolvedSurface {
  const { effectiveRole, device, urlView, urlGroup, storedView, shootSurfaceEnabled } = input

  const surface = SURFACE_BY_ROLE[effectiveRole]

  const urlViewMode = parseUrlView(urlView)
  const preForcingView: ViewMode =
    urlViewMode ?? storedView ?? DEFAULT_VIEW_BY_SURFACE[surface]
  const preForcingSource: ViewSource =
    urlViewMode !== null ? "url" : storedView !== null ? "stored" : "surface-default"
  const preForcingGroup: GroupKey = parseUrlGroup(urlGroup)

  // Device forcing — applied last, non-destructively. Provenance flips to
  // 'device-forced' only when forcing actually changed the outcome.
  const isMobile = device === "mobile"
  const forcingChangedOutcome =
    isMobile && (preForcingView !== "card" || preForcingGroup !== "none")

  const viewMode: ViewMode = isMobile ? "card" : preForcingView
  const groupKey: GroupKey = isMobile ? "none" : preForcingGroup
  const viewSource: ViewSource = forcingChangedOutcome ? "device-forced" : preForcingSource

  // Affordances/chrome — derived from surface + device + shootSurfaceEnabled
  // ONLY.
  //
  // FLAG OFF (5e-I, byte-identical): every value reproduces TODAY'S device
  // gate, deliberately surface-INDEPENDENT so rewired consumers are
  // zero-delta. The one named sub-delta: `export` keys to desktop, not
  // !mobile — the export route's RequireDesktop needs ≥1024px, so today's
  // 768-1023 tablet Export button dead-ends in a toast+redirect.
  //
  // FLAG ON (5e-II): the device term is DROPPED from every affordance —
  // consumers' role/global-claim terms still gate (presentation-only law) —
  // EXCEPT `export`, which keeps the desktop key (route constraint,
  // unchanged). Chrome reshapes for surface === 'shoot' only: minimal
  // toolbar, no view switcher, tap-row status control at EVERY density (the
  // shell uses the tap row on tablet/desktop too — Decision F's
  // desktop-density covers layout, not the control). Non-shoot surfaces keep
  // today's chrome identically (plan-build keeps the device-based
  // statusControl fork).
  const offMobile = device !== "mobile"
  const affordances: Affordances = shootSurfaceEnabled
    ? {
        fieldEditing: true,
        lifecycle: true,
        imageUpload: true,
        share: true,
        export: device === "desktop",
        bulkPull: true,
        repair: true,
        versionRestore: true,
      }
    : {
        fieldEditing: offMobile,
        lifecycle: offMobile,
        imageUpload: offMobile,
        share: offMobile,
        export: device === "desktop",
        bulkPull: offMobile,
        repair: offMobile,
        versionRestore: offMobile,
      }
  const chrome: Chrome =
    shootSurfaceEnabled && surface === "shoot"
      ? {
          toolbar: "minimal",
          viewSwitcher: false,
          quickAdd: true,
          statusControl: "tap-row",
        }
      : {
          toolbar: "full",
          viewSwitcher: offMobile,
          quickAdd: true,
          statusControl: device === "mobile" ? "tap-row" : "badge-select",
        }

  return { surface, viewMode, groupKey, viewSource, affordances, chrome }
}
