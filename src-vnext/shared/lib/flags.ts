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
}

const DEFAULT_FLAGS: FeatureFlags = {
  featurePublishing: false,
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
  return DEFAULT_FLAGS
}

/**
 * Convenience accessor for a single flag. Prefer this at call sites so the
 * flag name is grep-findable.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}
