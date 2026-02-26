import { cn } from "@/shared/lib/utils"

/**
 * Staggered pulse delay classes for wave effect.
 * 6 tiers at 150ms increments (0ms–750ms).
 */
const DELAY_CLASSES = [
  "",
  "[animation-delay:150ms]",
  "[animation-delay:300ms]",
  "[animation-delay:450ms]",
  "[animation-delay:600ms]",
  "[animation-delay:750ms]",
] as const

interface SkeletonLineProps {
  readonly className?: string
  /** Stagger tier 0–5 for wave animation */
  readonly delay?: number
}

export function SkeletonLine({ className, delay = 0 }: SkeletonLineProps) {
  return (
    <div
      className={cn(
        "h-4 animate-pulse rounded bg-[var(--color-surface-muted)]",
        DELAY_CLASSES[delay % 6],
        className,
      )}
    />
  )
}

interface SkeletonBlockProps {
  readonly className?: string
  readonly delay?: number
}

export function SkeletonBlock({ className, delay = 0 }: SkeletonBlockProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-[var(--color-surface-muted)]",
        DELAY_CLASSES[delay % 6],
        className,
      )}
    />
  )
}

/* ------------------------------------------------------------------ */
/*  Page-level skeleton patterns                                       */
/* ------------------------------------------------------------------ */

/** List page: toolbar + card grid (3 cols desktop, 2 tablet, 1 mobile) */
export function ListPageSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <SkeletonLine className="h-9 w-48" delay={0} />
        <SkeletonLine className="h-9 w-24" delay={1} />
        <div className="flex-1" />
        <SkeletonLine className="h-9 w-32" delay={2} />
      </div>
      {/* Card grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i} delay={i} />
        ))}
      </div>
    </div>
  )
}

/** Table: header row + data rows */
export function TableSkeleton({ rows = 6 }: { readonly rows?: number }) {
  return (
    <div className="flex flex-col gap-0 rounded-lg border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex gap-4 border-b border-[var(--color-border)] px-4 py-3">
        <SkeletonLine className="h-3 w-24" delay={0} />
        <SkeletonLine className="h-3 w-32" delay={1} />
        <SkeletonLine className="h-3 w-20" delay={2} />
        <SkeletonLine className="h-3 w-16" delay={3} />
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex gap-4 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0"
        >
          <SkeletonLine className="h-4 w-28" delay={i % 6} />
          <SkeletonLine className="h-4 w-36" delay={(i + 1) % 6} />
          <SkeletonLine className="h-4 w-20" delay={(i + 2) % 6} />
          <SkeletonLine className="h-4 w-16" delay={(i + 3) % 6} />
        </div>
      ))}
    </div>
  )
}

/** Detail page: breadcrumb + 2-column layout */
export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-3 w-16" delay={0} />
        <SkeletonLine className="h-3 w-4" delay={0} />
        <SkeletonLine className="h-3 w-24" delay={1} />
      </div>
      {/* Title */}
      <SkeletonLine className="h-7 w-64" delay={1} />
      {/* 2-column content */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-48" delay={2} />
          <SkeletonLine className="h-4 w-3/4" delay={3} />
          <SkeletonLine className="h-4 w-1/2" delay={4} />
        </div>
        <div className="flex flex-col gap-4">
          <SkeletonBlock className="h-32" delay={3} />
          <SkeletonLine className="h-4 w-2/3" delay={4} />
          <SkeletonLine className="h-4 w-1/3" delay={5} />
        </div>
      </div>
    </div>
  )
}

/** Single card skeleton */
export function CardSkeleton({ delay = 0 }: { readonly delay?: number }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-4">
      <SkeletonBlock className="mb-3 h-32" delay={delay} />
      <SkeletonLine className="mb-2 h-4 w-3/4" delay={(delay + 1) % 6} />
      <SkeletonLine className="h-3 w-1/2" delay={(delay + 2) % 6} />
    </div>
  )
}
