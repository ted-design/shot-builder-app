import { Link } from "react-router-dom"
import type { NextAction } from "@/features/projects/components/home/lib/computeNextAction"

/**
 * Dark "Do this next" bar (ledger project-home, mockup zone C). Renders the
 * single primary action surfaced by `computeNextAction`. Read-only: it only
 * navigates — it never mutates project data.
 *
 * Renders nothing when `action` is null (nothing actionable). The CTA is a
 * react-router `Link` to an absolute `/projects/:id/...` route owned by the
 * `NextAction` result. When the action carries an `alternate` (two next steps
 * apply at once — e.g. an empty project), an equal-weight "or {alternate}" link
 * is rendered beside the primary so the user picks rather than being forced.
 *
 * Tokens only — the bar uses the near-black ink token (`--color-text`) as its
 * fill to mirror the mockup's `--ink` band, with light text on top and the
 * Immediate-red accent for the primary CTA.
 */
export interface NextActionBarProps {
  /** Primary action to surface, or null to render nothing. */
  readonly action: NextAction | null
}

export function NextActionBar({ action }: NextActionBarProps) {
  if (!action) return null

  return (
    <div
      data-testid="next-action-bar"
      className="mt-6 flex flex-col gap-4 rounded-lg px-5 py-4 sm:flex-row sm:items-center sm:gap-5"
      style={{ background: "var(--color-text)" }}
    >
      <div className="min-w-0">
        <p
          className="text-3xs font-semibold uppercase tracking-[0.16em]"
          style={{ color: "var(--color-text-subtle)" }}
        >
          Do this next
        </p>
        <p
          className="mt-1 text-base leading-snug"
          style={{ fontFamily: "var(--font-serif)", color: "var(--color-bg)" }}
        >
          {action.message}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:ml-auto sm:shrink-0">
        <Link
          to={action.ctaTo}
          data-testid="next-action-cta"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-md px-[18px] py-[10px] text-sm font-semibold transition-colors"
          style={{ background: "var(--color-accent)", color: "var(--color-bg)" }}
        >
          {action.ctaText}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            className="h-[15px] w-[15px]"
            aria-hidden="true"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>

        {action.alternate && (
          <span
            className="text-sm whitespace-nowrap"
            style={{ color: "var(--color-text-subtle)" }}
          >
            or{" "}
            <Link
              to={action.alternate.ctaTo}
              data-testid="next-action-alt"
              className="font-semibold underline-offset-4 transition-colors hover:underline"
              style={{ color: "var(--color-bg)" }}
            >
              {action.alternate.ctaText}
            </Link>
          </span>
        )}
      </div>
    </div>
  )
}
