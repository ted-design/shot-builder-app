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

// PURE function, all inputs explicit — output is presentation-only by construction; no write
// handler may consume it. `effectiveRole` is the typed preview slot: callers pass an already-
// resolved role (5b upgrades the source; a future View-as feeds a simulated role here).

export type SurfaceDevice = "mobile" | "tablet" | "desktop"

/** Distinct review variants now — 5f splits client vs warehouse without an enum break. */
export type SurfaceKind = "plan-build" | "shoot" | "review-client" | "review-warehouse"

/** Provenance of the resolved viewMode/groupKey. */
export type ViewSource = "url" | "stored" | "surface-default" | "device-forced"

/** Derived only from rbac helpers + the REAL device; drives nothing until 5e. */
export interface SurfaceAffordances {
  readonly canCreateShots: boolean
  readonly canReorderShots: boolean
  readonly canBulkPull: boolean
  readonly canShare: boolean
  readonly canManageLanes: boolean
  // canExport has no role factor today (device-only, ported verbatim) — 5e decides
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
