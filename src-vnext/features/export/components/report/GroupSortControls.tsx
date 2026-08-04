// Shared order-by / direction control (R2/R5) for all three report ControlBars.
// Renders the "Order by" + "Direction" segmented controls only — the group-by
// control stays in each view (per-view legacy option set + the shot report's
// flag-on "Status" addition). The three views own distinct CSS namespaces
// (sb-*, sb-pir-*, sb-tr-*), so the class names are passed in; the markup +
// a11y (role="group" + useId'd label, aria-pressed) matches the existing segs.
// Gated: each view renders this ONLY when featureReportConfig is on, so flag-off
// is byte-identical (the controls never appear).

import { useId } from "react"
import type { JSX } from "react"
import { SORT_DIR_OPTIONS, type SortDir } from "../../lib/report/reportSort"

/** Per-view segmented-control class names (that view's CSS namespace). */
export interface SortControlClasses {
  readonly group: string
  readonly label: string
  readonly seg: string
  readonly segBtn: string
}

export interface GroupSortControlsProps<S extends string> {
  readonly classes: SortControlClasses
  readonly sortOptions: ReadonlyArray<{ readonly value: S; readonly label: string }>
  readonly sortBy: S
  readonly onSortBy: (value: S) => void
  readonly sortDir: SortDir
  readonly onSortDir: (value: SortDir) => void
}

export function GroupSortControls<S extends string>({
  classes,
  sortOptions,
  sortBy,
  onSortBy,
  sortDir,
  onSortDir,
}: GroupSortControlsProps<S>): JSX.Element {
  const orderLabelId = useId()
  const dirLabelId = useId()
  return (
    <>
      <div className={classes.group} role="group" aria-labelledby={orderLabelId}>
        <span id={orderLabelId} className={classes.label}>
          Order by
        </span>
        <div className={classes.seg}>
          {sortOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={classes.segBtn}
              aria-pressed={sortBy === opt.value}
              onClick={() => onSortBy(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={classes.group} role="group" aria-labelledby={dirLabelId}>
        <span id={dirLabelId} className={classes.label}>
          Direction
        </span>
        <div className={classes.seg}>
          {SORT_DIR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={classes.segBtn}
              aria-pressed={sortDir === opt.value}
              onClick={() => onSortDir(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
