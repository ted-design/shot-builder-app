export function scoreColorClass(score: number): string {
  if (score >= 0.8) return "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
  if (score >= 0.5) return "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]"
  return "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
}

export function scoreBarFillClass(score: number): string {
  if (score >= 0.8) return "bg-[var(--color-status-green-text)]"
  if (score >= 0.5) return "bg-[var(--color-status-amber-text)]"
  return "bg-[var(--color-text-subtle)]"
}
