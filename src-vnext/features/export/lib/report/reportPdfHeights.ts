// Height-aware pagination for the image-led Comprehensive Shot Report PDF.
//
// WHY: @react-pdf cannot measure-then-reflow, so the old paginate() blindly
// sliced two shots per page (`visible.slice(i, i+2)`) and laid them as two
// side-by-side wrap={false} plates inside one <Page wrap>. When a plate exceeded
// the page height (tall image + alt looks + notes + multi-product table) it
// bumped to a continuation page, leaving its partner stranded — producing blank
// pages, ~half-empty "stranded" pages, and a running header whose range no longer
// tracked the shots actually placed.
//
// FIX: estimate each plate's height from the resolved model, then GREEDILY PACK
// two columns — fill the left column top-to-bottom until the next plate would
// overflow the column, then the right column the same way, then start a new page.
// A plate is placed only where its (conservative) estimate fits, so a column's
// real height never exceeds the page — no mid-document blank/half pages. A plate
// whose estimate alone exceeds the column height gets its own page (it is
// inherently un-fittable; @react-pdf's wrap is the safety net). The running-header
// range is derived from the shots ACTUALLY placed on each page.
//
// The estimate is intentionally CONSERVATIVE on the dominant term (the hero image
// is capped at HERO_MAX_HEIGHT by `maxHeight`, so estimating it at the cap can
// only over-estimate, never under), which biases toward "column fits" over
// "column overflows". Constants mirror the styles in reportPdf.tsx; they are
// tuned for ~2 plates/page (one per column) for normal shots, a solo page for an
// unusually tall shot. COL_MAX / SAFETY are the knobs to tune at the :5174 eyeball.

import type { ReportModel, ReportGroup, ReportShot } from "./reportTypes"
import { PAGE, has, primaryLookImage } from "./reportPdfShared"

// --- Geometry: the SINGLE SOURCE for the image-led page layout. reportPdf.tsx
// imports these so the estimator and the renderer can't drift — a drift (e.g.
// bumping HERO_MAX_HEIGHT in only one file) would make the estimate stale and
// re-open the blank/stranded-page path this module exists to close. ---
export const PAD_X = 40
export const COLUMN_GAP = 36
const CONTENT_WIDTH = PAGE.width - PAD_X * 2
/** Width of one of the two plate columns (a plate's text wraps within this). */
export const PLATE_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2
/** Hero image figure cap — the figure's max height (reportPdf.tsx heroImage.maxHeight). */
export const HERO_MAX_HEIGHT = 300
/** "Awaiting capture" no-image frame height (reportPdf.tsx noImage.height). */
export const NO_IMAGE_HEIGHT = 230

/**
 * Estimate-scale threshold (pt): a plate estimated within this packs 2-up (one per
 * column); a plate estimated taller is inherently un-fittable and gets its own page,
 * packed alone so it never strands a partner (its tail may clip — see PackedSheet).
 *
 * EMPIRICALLY CALIBRATED against a real @react-pdf render of landscape Letter
 * (792×612): the true usable column is ~493pt actual (page height minus ~36/34
 * padding, the ~49pt in-flow fixed header, and the footer). estimatePlateHeight
 * carries a +5% safety, so the fit boundary on the estimate scale is ~493×1.05 ≈
 * 518; 515 sits just under it. Result: a 1-image + ≤3-product shot (estimate ~486–
 * 501) packs 2-up; only a genuinely too-tall shot (4+ products plus notes, or an
 * alt look — estimate ≳537) gets a solo splittable page. Tune here if the :5174
 * eyeball shows under/over-packing — lower if any normal page overflows, raise if
 * too many shots solo.
 */
export const COL_MAX = 515

/** Global safety multiplier on every estimate (covers proportional-font wrap slack). */
const SAFETY = 1.05

// --- Per-section estimate constants (mirror reportPdf.tsx styles) ---
const FIGURE_PAD = 13 // figure borderTop(1) + paddingTop(12)
const CAPTION_PAD = 12 // caption paddingTop
const TITLE_LINE = 16 // shotTitle fontSize 14 * lineHeight 1.1, rounded up
const COLORWAY_H = 13 // colorway fontSize 9 + marginTop 2 + slack
const SUBROW_H = 25 // status chip + talent row (marginTop 8 + paddingTop 7 + content)
const NOTE_BASE = 8 // note marginTop
const NOTE_LINE = 11 // note fontSize 7.5 * lineHeight 1.4, rounded up
const LOOKS_TOP = 12 // looks container marginTop
const LOOK_TOP = 10 // each look marginTop
const LOOK_HEAD = 14 // look header row (marginBottom 6 + label)
const ALT_FIGURE = 134 // alt thumb (maxHeight 110 + marginBottom 8) + lookAlt padding
const COLHEAD_H = 17 // product column header (paddingBottom 5 + marginBottom 5 + label)
const PRODUCT_ROW = 15 // one product row (marginBottom 5 + content; slack for occasional wrap)

/**
 * Conservative wrapped-line count for a text run at a given width. Uses a slightly
 * WIDE average glyph width so it errs toward MORE lines (Helvetica is proportional;
 * over-counting lines keeps the estimate safe). Clamped to [1, maxLines].
 */
export function estimateWrappedLines(
  text: string,
  widthPt: number,
  fontSizePt: number,
  maxLines: number,
): number {
  const avgGlyph = fontSizePt * 0.55
  const perLine = Math.max(1, Math.floor(widthPt / avgGlyph))
  const lines = Math.ceil(text.length / perLine)
  return Math.min(Math.max(1, lines), maxLines)
}

/**
 * Estimate the rendered height (pt) of one image-led plate from the resolved shot.
 * Conservative: hero image estimated at its cap; text wrap over-counted. Returns a
 * value comparable against COL_MAX for packing.
 */
export function estimatePlateHeight(shot: ReportShot): number {
  let h = 0

  // Figure: the plate shows the hero (capped at HERO_MAX_HEIGHT) iff the primary look
  // has an image candidate — INCLUDING a product-image fallback. Key off the same
  // signal the renderer uses (looks[0].image via primaryLookImage), NOT shot.hasImage,
  // which is false for a fallback and would under-estimate a plate that does show a hero.
  h += FIGURE_PAD + (has(primaryLookImage(shot)) ? HERO_MAX_HEIGHT : NO_IMAGE_HEIGHT)

  // Caption header
  h += CAPTION_PAD
  h += TITLE_LINE * estimateWrappedLines(shot.title ?? "", PLATE_WIDTH, 14, 3)
  if (has(shot.colorway)) h += COLORWAY_H
  // Status chip + talent row; talent names can wrap past the status chip's ~70pt.
  const talentText = shot.talent.map((t) => t.name).filter((nm) => has(nm)).join(" · ")
  h += SUBROW_H + (talentText ? (estimateWrappedLines(talentText, PLATE_WIDTH - 70, 7.5, 3) - 1) * NOTE_LINE : 0)
  if (has(shot.notes)) {
    h += NOTE_BASE + NOTE_LINE * estimateWrappedLines(shot.notes ?? "", PLATE_WIDTH - 8, 7.5, 4)
  }

  // Looks (already filtered by looksMode in the model)
  h += LOOKS_TOP
  for (const look of shot.looks) {
    h += LOOK_TOP + LOOK_HEAD
    if (look.isAlt) h += ALT_FIGURE
    h += COLHEAD_H
    h += PRODUCT_ROW * Math.max(1, look.products.length)
  }

  return Math.ceil(h * SAFETY)
}

/**
 * A packed landscape sheet. A normal sheet holds up to two plates (one per column,
 * each ≤ COL_MAX). An `oversized` sheet holds a single shot too tall for one page,
 * packed ALONE (empty right column) so it never strands a partner or blanks a
 * mid-document page. (Such a shot still exceeds one page and its tail is clipped by
 * @react-pdf; reshaping heavy plates — smaller hero / flowing looks — to truly fit
 * is a follow-up, not this pagination pass.) `firstPosition`/`lastPosition` are the
 * 1-based positions (within the group's visible shots) of the first/last shot placed
 * — the source for the running-header range. A sheet never spans a gender group.
 */
export interface PackedSheet {
  readonly group: ReportGroup
  readonly groupShotCount: number
  readonly firstPosition: number
  readonly lastPosition: number
  readonly leftColumn: readonly ReportShot[]
  readonly rightColumn: readonly ReportShot[]
  readonly oversized: boolean
}

/**
 * Pack the model's shots into landscape sheets. Image-led plates are tall (a hero
 * image plus its caption/looks), so two never fit stacked in one column — each
 * column holds exactly one plate, two per page. A shot taller than one page
 * (COL_MAX) gets its own sheet, packed alone, never paired. Pure and deterministic:
 * excluded shots are dropped, empty groups produce no sheet, a sheet never spans a
 * gender group, and every non-excluded shot is placed exactly once in order.
 */
export function packShotSheets(model: ReportModel): readonly PackedSheet[] {
  const sheets: PackedSheet[] = []
  for (const group of model.groups) {
    const visible = group.shots.filter((s) => !s.excluded)
    if (visible.length === 0) continue
    const heights = visible.map(estimatePlateHeight)
    const groupShotCount = visible.length

    let i = 0
    while (i < visible.length) {
      const first = visible[i]
      if (!first) break // unreachable (i in bounds); satisfies noUncheckedIndexedAccess
      const firstPosition = i + 1

      // A shot taller than one page gets its own page, allowed to split (no partner).
      if ((heights[i] ?? 0) > COL_MAX) {
        sheets.push({
          group,
          groupShotCount,
          firstPosition,
          lastPosition: firstPosition,
          leftColumn: [first],
          rightColumn: [],
          oversized: true,
        })
        i += 1
        continue
      }

      // Normal: this shot in the left column; the next FITTING shot (if any) in the
      // right. An oversized next shot is left for its own sheet, never paired here.
      const leftColumn: readonly ReportShot[] = [first]
      i += 1
      let rightColumn: readonly ReportShot[] = []
      const second = visible[i]
      if (second && (heights[i] ?? 0) <= COL_MAX) {
        rightColumn = [second]
        i += 1
      }

      sheets.push({
        group,
        groupShotCount,
        firstPosition,
        lastPosition: i, // i now points past the last placed shot → its 1-based position
        leftColumn,
        rightColumn,
        oversized: false,
      })
    }
  }
  return sheets
}
