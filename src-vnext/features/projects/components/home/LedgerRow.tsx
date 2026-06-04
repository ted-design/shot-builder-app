import { Link } from "react-router-dom"
import type { LedgerRow as LedgerRowModel } from "./lib/ledgerData"
import { SegmentedBar } from "./SegmentedBar"

/** Status-tag tone → token-driven Tailwind classes (mockup `.tag.*`). */
export type LedgerTagTone = "ok" | "info" | "warn" | "todo" | "crit"

export interface LedgerRowTag {
  /** Pill text, e.g. "4 roles unbooked". */
  readonly label: string
  /** Visual tone; maps to a token-driven color set. */
  readonly tone: LedgerTagTone
}

/**
 * One row of the status ledger view-model. The pure {@link LedgerRowModel}
 * (counts + segments + detail) plus presentational extras the parent derives:
 * the status tag, the attention flag, and the deep-link target.
 */
export interface LedgerRowViewModel {
  /** Pure ledger data for this stage (from `buildLedgerRows`). */
  readonly row: LedgerRowModel
  /** Roman-numeral index marker shown before the title (e.g. "i."). */
  readonly index?: string
  /** Optional status pill on the right (e.g. "Building list"). */
  readonly tag?: LedgerRowTag
  /** When true, the row gets the red attention rule + faint wash. */
  readonly flagged?: boolean
  /** Deep-link target for the row's arrow link (e.g. `/projects/p1/shots`). */
  readonly to?: string
  /** Arrow-link copy (e.g. "Open list"). Defaults to "Open". */
  readonly linkLabel?: string
}

const TAG_TONE_CLASSES: Record<LedgerTagTone, string> = {
  ok: "text-[var(--color-success)] border-[var(--color-success)]/40 bg-[var(--color-success)]/10",
  info: "text-[var(--color-info)] border-[var(--color-info)]/40 bg-[var(--color-info)]/10",
  warn: "text-[var(--color-warning)] border-[var(--color-warning)]/45 bg-[var(--color-warning)]/10",
  todo: "text-[var(--color-text-muted)] border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)]",
  crit: "text-[var(--color-accent)] border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10",
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function StatusTag({ tag }: { readonly tag: LedgerRowTag }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium ${TAG_TONE_CLASSES[tag.tone]}`}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full bg-current"
      />
      {tag.label}
    </span>
  )
}

/**
 * A single hairline-ruled ledger row (mockup zone D — `.stage`).
 *
 * Grid: name+meta · segmented bar · status tag · arrow link. Read-only — the
 * only interaction is the deep-link, which navigates (never mutates). Disabled
 * (gated) rows render the link muted and non-interactive.
 */
export function LedgerRow({
  row,
  index,
  tag,
  flagged = false,
  to,
  linkLabel = "Open",
}: LedgerRowViewModel) {
  const linkClasses =
    "group inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px] no-underline transition-colors"
  const disabled = !row.enabled || !to

  return (
    <div
      className={[
        "relative grid grid-cols-1 items-center gap-3 border-b border-[var(--color-border)] px-1 py-5 transition-colors",
        "md:grid-cols-[210px_1fr_156px_118px] md:gap-6",
        flagged
          ? "bg-[var(--color-accent)]/[0.06] shadow-[inset_2px_0_0_var(--color-accent)]"
          : "hover:bg-[var(--color-surface-subtle)]",
      ].join(" ")}
      data-flagged={flagged || undefined}
    >
      {/* Name + meta */}
      <div className="flex flex-col gap-1">
        <span
          className="flex items-baseline gap-2 text-[18px] font-semibold leading-none text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {index && (
            <span
              className="text-[13px] font-normal italic text-[var(--color-text-subtle)]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {index}
            </span>
          )}
          {row.label}
        </span>
        <span className="text-[11px] tabular-nums text-[var(--color-text-muted)]">
          {row.detail}
        </span>
      </div>

      {/* Segmented progress bar */}
      <SegmentedBar segments={row.segments} ariaLabel={`${row.label} progress`} />

      {/* Status tag */}
      <div>{tag && <StatusTag tag={tag} />}</div>

      {/* Arrow link */}
      <div className="md:justify-self-end">
        {disabled ? (
          <span
            className={`${linkClasses} cursor-default text-[var(--color-text-subtle)]`}
            aria-disabled="true"
          >
            {linkLabel}
            <ArrowIcon />
          </span>
        ) : (
          <Link
            to={to}
            className={`${linkClasses} text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]`}
          >
            {linkLabel}
            <ArrowIcon />
          </Link>
        )}
      </div>
    </div>
  )
}
