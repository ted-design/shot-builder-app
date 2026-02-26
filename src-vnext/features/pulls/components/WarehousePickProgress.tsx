interface WarehousePickProgressProps {
  readonly current: number
  readonly total: number
}

export function WarehousePickProgress({ current, total }: WarehousePickProgressProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="flex flex-col gap-2 px-4 py-3" data-testid="pick-progress">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[var(--color-text)]">
          Item {Math.min(current + 1, total)} of {total}
        </span>
        <span className="text-[var(--color-text-muted)]">{pct}% complete</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
        <div
          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
