/**
 * vNext feature flags registry.
 *
 * Start minimal — one boolean per flag, defaults are the conservative
 * production value. Downstream sub-phases will layer URL + localStorage
 * overrides on top (matching the legacy pattern) when flag toggling during
 * staged rollout is needed.
 *
 * Phase 3 publishing is flagged so the publish button + reader route stay
 * dark on `main` until the full vertical lands. Q10 = A — single flag for
 * both the write path (PublishCallSheetDialog) and the public reader route.
 */

export interface FeatureFlags {
  /** Phase 3 — Publishing & Crew Delivery Loop. See plan §10. */
  readonly featurePublishing: boolean
  /**
   * Phase 4 — resolveSurface job-default resolution in useShotListState.
   * Default OFF (flag-off path is byte-identical to pre-Phase-4 trunk).
   * Enabled ONLY via `VITE_SURFACE_RESOLVER=1` (or `true`) at build/dev time
   * (LoginPage VITE_USE_FIREBASE_EMULATORS precedent) — e.g. the :5174
   * eyeball runs `VITE_SURFACE_RESOLVER=1 npm run dev -- --port 5174`.
   * CI build env must never define it. No URL/localStorage override layer.
   */
  readonly featureSurfaceResolver: boolean
  /**
   * Phase 5a — unified two-column shot editor (ShotListPage fork A +
   * ShotDetailPage fork B). Default OFF (flag-off path is byte-identical to
   * pre-Phase-5a trunk). Enabled ONLY via `VITE_UNIFIED_SHOT_EDITOR=1` (or
   * `true`) at build/dev time — e.g. the :5174 eyeball runs
   * `VITE_UNIFIED_SHOT_EDITOR=1 npm run dev -- --port 5174`.
   * CI build env must never define it. No URL/localStorage override layer.
   * Independent of featureSurfaceResolver — never coupled (separate rollbacks).
   */
  readonly featureUnifiedShotEditor: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  featurePublishing: false,
  featureSurfaceResolver: false,
  featureUnifiedShotEditor: false,
}

/** '1' / 'true' (case-insensitive) parse, matching LoginPage.tsx:18-19. */
function parseEnvFlag(raw: unknown): boolean {
  const value = (raw ?? "").toString().toLowerCase()
  return value === "1" || value === "true"
}

/**
 * Read the current feature flag state.
 *
 * Sub-phase 3.0 ships the registry with defaults only; URL / localStorage /
 * env overrides are deferred to sub-phase 3.2 when the publish button first
 * needs toggling. Keeping the signature a function (not a constant export)
 * so the override plumbing can be threaded through without a type-break.
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    ...DEFAULT_FLAGS,
    featureSurfaceResolver:
      DEFAULT_FLAGS.featureSurfaceResolver ||
      parseEnvFlag(import.meta.env.VITE_SURFACE_RESOLVER),
    featureUnifiedShotEditor:
      DEFAULT_FLAGS.featureUnifiedShotEditor ||
      parseEnvFlag(import.meta.env.VITE_UNIFIED_SHOT_EDITOR),
  }
}

/**
 * Convenience accessor for a single flag. Prefer this at call sites so the
 * flag name is grep-findable.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}
