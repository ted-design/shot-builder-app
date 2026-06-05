import type { Project } from "@/shared/types"
import { StatusBadge } from "@/shared/components/StatusBadge"
import {
  getStatusColor,
  getStatusLabel,
  getBriefHost,
  isSafeHttpUrl,
} from "@/features/projects/lib/projectStatus"
import { textPreview } from "@/shared/lib/textPreview"

/**
 * Ledger project-home hero band (mockup zones A + B) — the orientation header a
 * producer lands on at /projects/:id.
 *
 * Renders, left→right / top→bottom:
 *   - eyebrow: "<client> · <job type>" + status pill (A)
 *   - title in --font-display with the brand-red period (A)
 *   - tagline in --font-serif italic (A)
 *   - brief chip linking to the external brief (A)
 *   - shoot countdown: days-to-shoot + date + optional call time (B)
 *
 * READ-ONLY and PROPS-DRIVEN: this component fetches NO data and performs NO
 * writes. The parent passes the already-loaded `project` plus a pre-derived
 * `countdown` (days/date/call time have caller-side data sources — earliest
 * ScheduleEntry, shootDates lib — so the hero stays a pure presentation leaf).
 * Every color / font is a design token; no hardcoded hex.
 */

export interface ProjectHeroCountdown {
  /** Whole days from today until the shoot (>= 0). */
  readonly days: number
  /** Pre-formatted shoot-day label, e.g. "Tuesday, June 9". */
  readonly dateLabel: string
  /** Optional pre-formatted call time, e.g. "07:30". Omitted when no source. */
  readonly callTime?: string
}

export interface ProjectHeroProps {
  /** The loaded project (name, status, briefUrl, notes). */
  readonly project: Project
  /**
   * Eyebrow line above the title — typically "<client name> · <job type>". The
   * parent resolves clientId→name and job type (no clean project-scoped source),
   * so it is passed in. Omitted entirely when empty.
   */
  readonly eyebrow?: string
  /**
   * Tagline beneath the title. Defaults to a plain-text preview of
   * `project.notes`. Pass explicitly to override.
   */
  readonly tagline?: string
  /**
   * Brief link label, e.g. "UM Spring '26 · No. 3". Defaults to the project
   * name. The chip itself only renders when `project.briefUrl` is set.
   */
  readonly briefLabel?: string
  /**
   * Pre-derived shoot countdown, or null when no shoot date is set (the
   * countdown column is then omitted / degraded).
   */
  readonly countdown: ProjectHeroCountdown | null
}

export function ProjectHero({
  project,
  eyebrow,
  tagline,
  briefLabel,
  countdown,
}: ProjectHeroProps) {
  const resolvedTagline = tagline ?? textPreview(project.notes, 160)
  // Only link http(s) brief URLs — a stored `javascript:`/`data:` URL would
  // otherwise execute on click (see isSafeHttpUrl).
  const safeBriefUrl = isSafeHttpUrl(project.briefUrl) ? project.briefUrl!.trim() : ""
  const briefHost = getBriefHost(safeBriefUrl)
  const hasBrief = safeBriefUrl.length > 0

  return (
    <section
      className={`grid grid-cols-1 items-end gap-10 border-b pb-6 ${
        countdown ? "md:grid-cols-[1.45fr_1fr]" : "md:grid-cols-1"
      }`}
      style={{ borderColor: "var(--color-border-strong)" }}
      data-testid="project-hero"
    >
      {/* ── Zone A: identity ── */}
      <div>
        {eyebrow ? (
          <div
            className="flex items-center gap-2.5 text-2xs uppercase"
            style={{
              letterSpacing: "0.18em",
              color: "var(--color-text-muted)",
            }}
          >
            <span>{eyebrow}</span>
            <StatusBadge
              label={getStatusLabel(project.status)}
              color={getStatusColor(project.status)}
            />
          </div>
        ) : (
          <StatusBadge
            label={getStatusLabel(project.status)}
            color={getStatusColor(project.status)}
          />
        )}

        <h1
          className="mt-3 font-bold leading-[0.92] tracking-[-0.01em]"
          style={{ fontSize: "62px", fontFamily: "var(--font-display)", color: "var(--color-text)" }}
        >
          {project.name}
          <span className="iconic-period">.</span>
        </h1>

        {resolvedTagline ? (
          <p
            className="mt-2.5 max-w-[38ch] text-base font-light italic leading-snug"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--color-text-secondary)",
            }}
            data-testid="project-hero-tagline"
          >
            {resolvedTagline}
          </p>
        ) : null}

        {hasBrief ? (
          <a
            href={safeBriefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium no-underline transition-colors"
            style={{
              borderColor: "var(--color-border-strong)",
              color: "var(--color-text)",
              backgroundColor: "var(--color-surface)",
            }}
            data-testid="project-hero-brief"
          >
            <span
              className="text-3xs uppercase"
              style={{ letterSpacing: "0.14em", color: "var(--color-text-muted)" }}
            >
              Brief
            </span>
            <span>{briefLabel ?? project.name}</span>
            {briefHost ? (
              <span className="text-xxs" style={{ color: "var(--color-text-muted)" }}>
                · {briefHost}
              </span>
            ) : null}
          </a>
        ) : null}
      </div>

      {/* ── Zone B: shoot countdown ── */}
      {countdown ? (
        <div className="text-left md:text-right" data-testid="project-hero-countdown">
          <div
            className="font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "4.625rem",
              lineHeight: "0.8",
              color: "var(--color-text)",
            }}
          >
            <span style={{ color: "var(--color-accent)" }}>{countdown.days}</span>
          </div>
          <div
            className="mt-2.5 text-xs uppercase"
            style={{ letterSpacing: "0.14em", color: "var(--color-text-muted)" }}
          >
            {countdown.days === 1 ? "Day to shoot" : "Days to shoot"}
          </div>
          <div
            className="mt-1 text-sm"
            style={{
              fontFamily: "var(--font-serif)",
              color: "var(--color-text-secondary)",
            }}
          >
            {countdown.dateLabel}
            {countdown.callTime ? ` · Call ${countdown.callTime}` : ""}
          </div>
        </div>
      ) : null}
    </section>
  )
}
