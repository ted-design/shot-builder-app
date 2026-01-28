/**
 * PDF Inputs — Canonical helper for unifying Open PDF Preview and Export PDF.
 *
 * Both entrypoints MUST call `buildPdfInputs()` so that they share the same
 * options, the same base lanes (after filters + image fallbacks), and the
 * same summary data. Any additional processing (e.g. image inlining via
 * Web Worker) is an enhancement applied on top of the returned `lanes`.
 *
 * `options.fields.image` is the single canonical image gate.
 */

import { shouldRenderExportImage } from './exportImageOptions';

/**
 * Strip image data from all shots in the given lanes.
 * Used when images are disabled (`options.fields.image === false`).
 *
 * @param {Array} lanes
 * @returns {Array} New array with shot.image set to null
 */
export function stripLaneImages(lanes) {
  return lanes.map((lane) => {
    const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
    const shots = laneShots.map((shot) => ({ ...shot, image: null }));
    return { ...lane, shots };
  });
}

/**
 * Build the canonical PDF inputs object.
 *
 * Both "Open PDF preview" and "Export PDF" handlers must call this
 * function and use its return values. This guarantees the two code
 * paths can never diverge on options, lanes, or summary data.
 *
 * When images are disabled, lanes are returned with images stripped.
 * When images are enabled, lanes are returned as-is (with fallback
 * images already applied by the caller).
 *
 * @param {Object} params
 * @param {Object} params.options      - derivedLegacyOptions (canonical)
 * @param {Array}  params.lanes        - lanesWithImageFallback
 * @param {Object} params.laneSummary  - derivedLaneSummary
 * @param {Object} params.talentSummary - derivedTalentSummary
 * @returns {{ options: Object, lanes: Array, laneSummary: Object, talentSummary: Object, meta: Object }}
 */
export function buildPdfInputs({ options, lanes, laneSummary, talentSummary }) {
  const imagesEnabled = Boolean(options?.fields?.image);

  const preparedLanes = imagesEnabled ? lanes : stripLaneImages(lanes);

  // Compute meta for DEV logging / debugging
  const allShots = (lanes || []).flatMap((l) =>
    Array.isArray(l.shots) ? l.shots : []
  );
  const shotsWithImageCount = allShots.filter((shot) =>
    shouldRenderExportImage(
      options,
      shot,
      Boolean(
        Array.isArray(shot?.productImages) && shot.productImages.find(Boolean)
      )
    )
  ).length;

  return {
    options,
    lanes: preparedLanes,
    laneSummary,
    talentSummary,
    meta: {
      imagesEnabled,
      lanesCount: (lanes || []).length,
      shotsCountTotal: allShots.length,
      shotsWithImageCount,
    },
  };
}

/**
 * DEV-only logging for proving Open Preview == Export PDF.
 *
 * Call this inside each handler ONCE per click. It logs a compact
 * fingerprint of the inputs so a developer can visually confirm
 * the two code paths received identical data.
 *
 * @param {'open-preview' | 'export-pdf'} source
 * @param {Object} meta - The `meta` object returned by `buildPdfInputs()`
 * @param {Object} options - The canonical options object
 */
export function logPdfInputs(source, meta, options) {
  if (process.env.NODE_ENV !== 'development') return;

  // Build a stable fingerprint of the key option fields
  const optionsHash = JSON.stringify({
    layout: options?.layout,
    density: options?.density,
    orientation: options?.orientation,
    fieldsImage: options?.fields?.image,
    fieldsShotNumber: options?.fields?.shotNumber,
    fieldsName: options?.fields?.name,
    fieldsType: options?.fields?.type,
    fieldsDate: options?.fields?.date,
    fieldsLocation: options?.fields?.location,
    fieldsTalent: options?.fields?.talent,
    fieldsProducts: options?.fields?.products,
    fieldsNotes: options?.fields?.notes,
    includeLaneSummary: options?.includeLaneSummary,
    includeTalentSummary: options?.includeTalentSummary,
  });

  console.log(
    `[PDF-INPUTS] source=${source} | optionsHash=${optionsHash} | imagesEnabled=${meta.imagesEnabled} | lanesCount=${meta.lanesCount} | shotsCountTotal=${meta.shotsCountTotal} | shotsWithImageCount=${meta.shotsWithImageCount}`
  );
}
