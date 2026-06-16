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
   * Default flipped to ON at 5e-I (was OFF since Phase 4). The ONE named,
   * accepted behavior change of the flip: never-customized producers on
   * tablet/desktop land on the plan-build 'table' surface default instead of
   * 'card'. Everyone else is byte-identical (URL/stored choices still win;
   * crew/warehouse/viewer resolution is inert vs legacy).
   * `VITE_SURFACE_RESOLVER` is kept as the enable-only override hook
   * (LoginPage VITE_USE_FIREBASE_EMULATORS precedent) — inert while the
   * default is true; retire it at flag removal. No URL/localStorage
   * override layer.
   */
  readonly featureSurfaceResolver: boolean
  /**
   * Phase 5e — the Shoot surface. Gates ALL Phase 5e behavior: the Shoot
   * shell render, the `!isMobile` capability removals, and the View-as menu.
   * Structurally requires resolver output — the shell mounts only off a
   * resolved `surface === 'shoot'`, never off this flag alone.
   * Default OFF (flag-off path is byte-identical to 5e-I trunk). Enabled
   * ONLY via `VITE_SHOOT_SURFACE=1` (or `true`) at build/dev time
   * (featureSurfaceResolver env-parse precedent). CI build env must never
   * define it. No URL/localStorage override layer.
   */
  readonly featureShootSurface: boolean
  /**
   * Phase 5f — the Review surfaces (client + warehouse). Gates the read-only
   * Review shell render (ReviewShotDetail) and the client gallery list fork.
   * Like featureShootSurface, structurally requires resolver output — the
   * shell mounts only off a resolved `surface === 'review-client'` (5f-II) /
   * `'review-warehouse'` (5f-III), never off this flag alone. NO rules change
   * rides on this flag (5f-I owns rules; the comment rules already permit
   * viewers). Default OFF (flag-off path is byte-identical to the 5f-I trunk).
   * Enabled ONLY via `VITE_REVIEW_SURFACE=1` (or `true`) at build/dev time
   * (featureShootSurface env-parse precedent). CI build env must never define
   * it. No URL/localStorage override layer.
   */
  readonly featureReviewSurface: boolean
  /**
   * Talent redesign Phase 1a — roster IA. Gates the surfaced Height/Waist
   * toolbar range controls + the result count on LibraryTalentPage. Default
   * OFF; the flag-off path is byte-identical to trunk. Enabled via
   * `VITE_TALENT_ROSTER_IA=1` (or `true`) at build/dev time
   * (featureReviewSurface env-parse precedent). No URL/localStorage layer.
   */
  readonly featureTalentRosterIA: boolean
  /**
   * Talent redesign Phase 2 — detail IA. Gates the regrouped talent detail
   * panel (inline contact meta-line + Fit-signals / Creative-assets zones +
   * Projects demoted to a read-only tag row) on TalentDetailPanel. Default
   * OFF; the flag-off path is byte-identical to trunk. Enabled via
   * `VITE_TALENT_DETAIL_IA=1` (or `true`) at build/dev time
   * (featureTalentRosterIA env-parse precedent). No URL/localStorage layer.
   */
  readonly featureTalentDetailIA: boolean
  /**
   * Maintenance — shot-list "filter by talent". Gates scoping the talent
   * filter options to project-attached talent (talent.projectIds) plus a
   * search box and Project/All grouping on FilterValuePicker. Default OFF;
   * the flag-off path is the byte-identical full-library CheckboxList.
   * Enabled via `VITE_SHOT_FILTER_TALENT_SCOPE=1` (or `true`) at build/dev
   * time (featureTalentDetailIA env-parse precedent). No URL/localStorage layer.
   */
  readonly featureShotFilterTalentScope: boolean
  /**
   * Maintenance — talent agency controlled input. Gates the AgencyCombobox
   * (type-to-filter over known agencies + create-new) that replaces the
   * free-text agency InlineEdit on TalentHeroZone and the agency Input on
   * CreateTalentDialog. Default OFF; the flag-off path is the byte-identical
   * free-text InlineEdit / Input. Enabled via `VITE_TALENT_AGENCY_COMBOBOX=1`
   * (or `true`) at build/dev time (featureShotFilterTalentScope env-parse
   * precedent). No URL/localStorage layer. Run scripts/normalize-agency-names.ts
   * before the prod flip — the agency filter is exact-equality.
   */
  readonly featureTalentAgencyCombobox: boolean
  /**
   * Talent redesign Phase 3 — casting matcher = its own ranked surface. Gates
   * promoting the casting brief from an in-place roster re-sort mode to a
   * dedicated score-first surface on LibraryTalentPage (brief + ranked
   * results replace the roster; no in-place re-sort or roster score badges).
   * Default OFF; the flag-off path is the byte-identical panel-above-roster
   * mode. Enabled via `VITE_CASTING_MATCHER_SURFACE=1` (or `true`) at
   * build/dev time (featureTalentAgencyCombobox env-parse precedent). No
   * URL/localStorage layer.
   */
  readonly featureCastingMatcherSurface: boolean
}

const DEFAULT_FLAGS: FeatureFlags = {
  featurePublishing: false,
  featureSurfaceResolver: true,
  featureShootSurface: false,
  featureReviewSurface: false,
  featureTalentRosterIA: false,
  featureTalentDetailIA: false,
  featureShotFilterTalentScope: false,
  featureTalentAgencyCombobox: false,
  featureCastingMatcherSurface: false,
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
    featureShootSurface:
      DEFAULT_FLAGS.featureShootSurface ||
      parseEnvFlag(import.meta.env.VITE_SHOOT_SURFACE),
    featureReviewSurface:
      DEFAULT_FLAGS.featureReviewSurface ||
      parseEnvFlag(import.meta.env.VITE_REVIEW_SURFACE),
    featureTalentRosterIA:
      DEFAULT_FLAGS.featureTalentRosterIA ||
      parseEnvFlag(import.meta.env.VITE_TALENT_ROSTER_IA),
    featureTalentDetailIA:
      DEFAULT_FLAGS.featureTalentDetailIA ||
      parseEnvFlag(import.meta.env.VITE_TALENT_DETAIL_IA),
    featureShotFilterTalentScope:
      DEFAULT_FLAGS.featureShotFilterTalentScope ||
      parseEnvFlag(import.meta.env.VITE_SHOT_FILTER_TALENT_SCOPE),
    featureTalentAgencyCombobox:
      DEFAULT_FLAGS.featureTalentAgencyCombobox ||
      parseEnvFlag(import.meta.env.VITE_TALENT_AGENCY_COMBOBOX),
    featureCastingMatcherSurface:
      DEFAULT_FLAGS.featureCastingMatcherSurface ||
      parseEnvFlag(import.meta.env.VITE_CASTING_MATCHER_SURFACE),
  }
}

/**
 * Convenience accessor for a single flag. Prefer this at call sites so the
 * flag name is grep-findable.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return getFeatureFlags()[flag]
}
