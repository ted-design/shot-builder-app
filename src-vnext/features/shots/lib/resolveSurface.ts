import type { Role } from "@/shared/types"
import type { TableColumnConfig } from "@/shared/types/table"
import type { ViewMode, GroupKey } from "@/features/shots/lib/shotListFilters"
import { SHOT_TABLE_COLUMNS } from "@/features/shots/lib/shotTableColumns"
import {
  canGeneratePulls,
  canManagePulls,
  canManageProjects,
  canManageShots,
} from "@/shared/lib/rbac"

// ---------------------------------------------------------------------------
// resolveSurface — Phase 4 (build spec 2026-06-09, §The API).
//
// PURE function. No hook, no hidden reads (auth / URL / localStorage / media
// queries), no writes. Every input is explicit so the resolution is fully
// testable as a (role × device × url × stored) matrix.
//
// `effectiveRole` is OPAQUE to this module — it is already resolved by the
// caller. Phase 4 feeds `normalizeRole(globalClaim)` (via AuthProvider).
// Phase 5b upgrades the SOURCE to a live members-doc read (Ted, 2026-06-09 —
// Q5/Q6: project wins, admin excepted) without touching this signature.
// That injection point is also the typed PREVIEW SLOT: a future View-as
// control (deferred to 4b/5e) feeds a simulated role here — presentation
// only, never into can*/write handlers.
//
// Security invariants (spec §Security):
// - Output is presentation-only BY CONSTRUCTION. No write handler may consume
//   it. `affordances` derive ONLY from existing rbac.ts helpers + the REAL
//   device, and drive nothing in Phase 4 (typed slot for 5e/5f).
// - Zero URL writes: resolution is a derivation. Mobile forcing is
//   override-without-erase — latent ?view/?group params are never erased.
// - Do NOT import or call rbac.ts `resolveEffectiveRole` (quarantined → 5b).
// ---------------------------------------------------------------------------

export type SurfaceDevice = "mobile" | "tablet" | "desktop"

/**
 * Distinct review variants NOW: Phase 5f splits client vs warehouse review;
 * a single 'review' enum value would force a breaking change later.
 */
export type SurfaceKind = "plan-build" | "shoot" | "review-client" | "review-warehouse"

/** Provenance of the resolved viewMode/groupKey — testability hook. */
export type ViewSource = "url" | "stored" | "surface-default" | "device-forced"

/**
 * Capability-shaped presentation hints. Derived ONLY from existing rbac.ts
 * helpers + the real device. Typed but DRIVES NOTHING in Phase 4 — the
 * `role && !isMobile` capability flags in ShotListPage stay the owners until
 * 5e. All fields are required booleans (never optional-default-true; see
 * spec invariant 6 re: the ShotsTable `canManageLanes = true` fail-open).
 */
export interface SurfaceAffordances {
  readonly canCreateShots: boolean
  readonly canReorderShots: boolean
  readonly canBulkPull: boolean
  readonly canShare: boolean
  /** Lane/scene writes — admin|producer|warehouse, matching the /lanes rule. */
  readonly canManageLanes: boolean
  /**
   * Ported verbatim from ShotListPage: canExport has NO role factor today
   * (device-only). Flagged to Ted — 5e decides whether a role gate is added.
   */
  readonly canExport: boolean
}

/** Typed chrome slot — drives nothing in Phase 4 (consumed at 5e/5f). */
export interface SurfaceChrome {
  readonly toolbar: "full" | "minimal" | "none"
  readonly quickAdd: boolean
  readonly viewSwitcher: boolean
}

/**
 * INPUTS to useTableColumns ONLY — never resolved visible/width/order.
 * useTableColumns stays the sole owner of column state. Phase 4 outputs the
 * single shared default set + an empty suffix; the single-key vs
 * per-surface-key question is Phase 6's entry decision.
 */
export interface SurfaceColumns {
  readonly defaultColumns: readonly TableColumnConfig[]
  readonly storageKeySuffix: string
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
}

export interface ResolvedSurface {
  readonly surface: SurfaceKind
  readonly viewMode: ViewMode
  readonly groupKey: GroupKey
  readonly viewSource: ViewSource
  readonly columns: SurfaceColumns
  readonly affordances: SurfaceAffordances
  readonly chrome: SurfaceChrome
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
  const { effectiveRole, device, urlView, urlGroup, storedView } = input

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

  return {
    surface,
    viewMode,
    groupKey,
    viewSource,
    columns: {
      defaultColumns: SHOT_TABLE_COLUMNS,
      storageKeySuffix: "",
    },
    affordances: {
      canCreateShots: canManageShots(effectiveRole),
      canReorderShots: canManageShots(effectiveRole),
      canBulkPull: canGeneratePulls(effectiveRole) && device !== "mobile",
      canShare: canManageProjects(effectiveRole),
      canManageLanes: canManagePulls(effectiveRole),
      canExport: device !== "mobile",
    },
    chrome: {
      toolbar: "full",
      quickAdd: canManageShots(effectiveRole),
      viewSwitcher: device !== "mobile",
    },
  }
}
