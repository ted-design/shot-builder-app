// Warehouse review list — the product-led pull list (Phase 5f-III, spec §PR
// partition 5f-III).
//
// Mounted by ShotListPage INSTEAD of the producer table/card forks when
// `featureReviewSurface` is ON and the resolved surface === 'review-warehouse'
// (surface-keyed, not device-keyed — the Shoot-shell / review-client
// precedent). This is the LIST counterpart to ReviewShotDetail's warehouse
// variant: the warehouse's job is to PULL, so the surface leads with WHAT to
// pull, not with hero images. Each row is one aggregated product requirement
// (buildWarehousePullList collapses the same garment/colour/size requested by
// multiple shots into ONE row) carrying everything needed to FIND the item —
// product label, colourway, size, style/SKU — plus the shots that need it.
//
// PRESENTATION, not a permission boundary (spec §Rules-vs-UI): strictly
// read-only — no bulk actions, no quick-add, no FAB, no lifecycle menu, no
// status writes. The firestore rules already gate every write; this surface
// simply does not render the producer affordances.
//
// ⚠️ NO prep / pull-status column — there is no per-product fulfilment field in
// the shot/product model (that state lives in the SEPARATE pulls feature). A
// row shows what the warehouse needs to LOCATE the item, never a fabricated
// prep state. Tapping a "needed-for" shot chip opens that shot (onOpenShot).
import { useMemo } from "react"
import { buildWarehousePullList } from "@/features/shots/lib/warehousePullList"
import type { Shot, ProductFamily } from "@/shared/types"

export interface ReviewWarehouseListProps {
  /** Display-order shots whose products feed the aggregated pull list. */
  readonly shots: ReadonlyArray<Shot>
  /** Resolves product style numbers for each pull-list row. */
  readonly familyById: ReadonlyMap<string, ProductFamily>
  readonly onOpenShot: (shotId: string) => void
}

export function ReviewWarehouseList({
  shots,
  familyById,
  onOpenShot,
}: ReviewWarehouseListProps) {
  // Aggregate once per shots/family change — pure + deterministic.
  const rows = useMemo(
    () => buildWarehousePullList(shots, familyById),
    [shots, familyById],
  )

  return (
    <div
      className="flex flex-col gap-2.5"
      data-testid="review-warehouse-pull-list"
    >
      {rows.map((row) => (
        <PullListRowItem key={row.key} row={row} onOpenShot={onOpenShot} />
      ))}
    </div>
  )
}

function PullListRowItem({
  row,
  onOpenShot,
}: {
  readonly row: ReturnType<typeof buildWarehousePullList>[number]
  readonly onOpenShot: (shotId: string) => void
}) {
  return (
    <div
      className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
      data-testid="pull-list-row"
      data-row-key={row.key}
    >
      {/* ── What to pull: colourway swatch + product label + style/SKU. The
          swatch is name-driven (the model carries no hex), so it reads as a
          quiet labelled chip, never a fabricated colour. ── */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        {row.colourName && (
          <span className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-[var(--color-text-secondary)]">
            {row.colourName}
          </span>
        )}
        <span className="text-base font-semibold leading-tight text-[var(--color-text)]">
          {row.label}
        </span>
        {row.styleNumber && (
          <span className="ml-auto text-2xs tabular-nums text-[var(--color-text-subtle)]">
            {row.styleNumber}
          </span>
        )}
      </div>

      {/* ── Needed for: the shots requesting this item. Each chip is a button
          that opens its shot (the only affordance on this read-only surface). ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">
          Needed for
        </span>
        {row.neededByShots.map((ref) => (
          <button
            key={ref.shotId}
            type="button"
            onClick={() => onOpenShot(ref.shotId)}
            className="inline-flex items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            data-testid="pull-list-shot-chip"
            data-shot-id={ref.shotId}
          >
            {ref.shotLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
