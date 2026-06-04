import { LedgerRow, type LedgerRowViewModel } from "./LedgerRow"

interface StatusLedgerProps {
  /**
   * Ordered ledger rows (shots → casting → pulls → call sheet → export), each a
   * pure {@link import("./lib/ledgerData").LedgerRow} plus the presentational
   * extras (tag, flag, deep-link) the parent derives. Build the `row` data with
   * `buildLedgerRows` from `./lib/ledgerData`.
   */
  readonly rows: readonly LedgerRowViewModel[]
  /** Right-aligned sub-line in the section header (e.g. "This project only · live"). */
  readonly subline?: string
}

/**
 * Status ledger (mockup zone D) — "Where the shoot stands." Renders each stage
 * as a hairline-ruled {@link LedgerRow} with a proportional segmented bar.
 *
 * Fully presentational and read-only: no hooks, no data access, no writes. The
 * parent page fetches data, runs the `ledgerData` adapters, attaches per-row
 * tags/flags/links, and passes the resulting view-models down.
 */
export function StatusLedger({ rows, subline }: StatusLedgerProps) {
  return (
    <section className="mt-12">
      <div className="mb-1 flex items-baseline gap-3.5">
        <h2
          className="text-[25px] leading-[0.92] tracking-[-0.01em] text-[var(--color-text)]"
          style={{ fontFamily: "var(--font-display)", fontWeight: 700 }}
        >
          Where the shoot stands
          <span className="iconic-period">.</span>
        </h2>
        {subline && (
          <span className="ml-auto text-[11.5px] text-[var(--color-text-muted)]">
            {subline}
          </span>
        )}
      </div>

      <div className="mt-4 border-t border-[var(--color-border-strong)]">
        {rows.map((vm) => (
          <LedgerRow key={vm.row.key} {...vm} />
        ))}
      </div>
    </section>
  )
}
