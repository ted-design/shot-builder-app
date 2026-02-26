import type { PullItem } from "@/shared/types"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"

interface WarehousePickStepProps {
  readonly item: PullItem
}

export function WarehousePickStep({ item }: WarehousePickStepProps) {
  const familyName = item.familyName ?? item.familyId
  const colourName = item.colourName ?? null
  const styleNumber = item.styleNumber ?? null
  // PullItem doesn't carry image paths; show placeholder
  const imageUrl = useStorageUrl(null)

  const totalQty = item.sizes.reduce((sum, s) => sum + s.quantity, 0)

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4" data-testid="pick-step">
      {/* Product image placeholder */}
      <div className="flex aspect-square max-h-[50vh] items-center justify-center rounded-lg bg-[var(--color-surface-muted)]">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={familyName}
            className="h-full w-full rounded-lg object-contain"
          />
        ) : (
          <span className="text-lg text-[var(--color-text-subtle)]">No Image</span>
        )}
      </div>

      {/* Product details */}
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-[var(--color-text)]">{familyName}</h2>
        {colourName && (
          <p className="text-sm text-[var(--color-text-secondary)]">Colorway: {colourName}</p>
        )}
        {styleNumber && (
          <p className="text-sm text-[var(--color-text-muted)]">Style #{styleNumber}</p>
        )}
      </div>

      {/* Size breakdown */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
          Sizes — {totalQty} total
        </p>
        <div className="grid grid-cols-3 gap-2">
          {item.sizes.map((s) => (
            <div
              key={s.size}
              className="flex flex-col items-center rounded-md bg-[var(--color-surface-subtle)] px-2 py-2"
            >
              <span className="text-sm font-medium text-[var(--color-text)]">{s.size}</span>
              <span className="text-xs text-[var(--color-text-muted)]">Qty {s.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {item.notes && (
        <p className="text-sm text-[var(--color-text-muted)]">{item.notes}</p>
      )}
    </div>
  )
}
