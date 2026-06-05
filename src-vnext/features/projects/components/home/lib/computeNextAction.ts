import type { ShotFirestoreStatus } from "@/shared/types"

/**
 * Pure derivation of the single primary "Do this next" action shown in the
 * ledger project-home next-action bar (mockup zone C). The caller adapts hook
 * data into a flat, serializable input and renders the result; this module owns
 * NO React and performs NO data access, so it is fully unit-testable.
 *
 * Priority order (first matching wins):
 *   1. unbooked casting near shoot — talent still unbooked AND the shoot is
 *      within the lock window. Casting blocks wardrobe and the call sheet, so it
 *      is the most time-critical gap as the shoot approaches.
 *   2. missing samples — product samples not yet arrived; nothing can be shot
 *      without them.
 *   3. unsent / no call sheet — the schedule is not ready to distribute.
 *   4. build shot list — the project has no shots yet, so the very first move is
 *      to draft the list.
 *
 * Returns null when nothing is actionable (everything below threshold).
 */

/** Days before the shoot at which unbooked casting becomes the top priority. */
export const CASTING_LOCK_WINDOW_DAYS = 14

export interface NextActionInput {
  /** Project id, used to build absolute CTA links (`/projects/:id/...`). */
  readonly projectId: string
  /**
   * Shot status tallies, exactly as returned by
   * `computeInsights(shots).statusCounts`.
   */
  readonly shotCounts: Record<ShotFirestoreStatus, number>
  /** Casting readiness derived from the casting board. */
  readonly casting: {
    /**
     * Number of talent/roles not yet locked. Caller derives this from
     * `useCastingBoard` entries that are not `booked` (and not `passed`).
     */
    readonly unbooked: number
  }
  /** Sample readiness aggregated across the shoot's products. */
  readonly samples: {
    /** Count of required samples that have not yet arrived. */
    readonly missing: number
  }
  /** Call-sheet / schedule readiness. */
  readonly schedule: {
    /** Whether any call sheet / schedule exists for the project. */
    readonly hasCallSheet: boolean
    /**
     * Whether the call sheet has been sent. No "sent" field exists in the data
     * model today, so the caller passes `false`; typed for forward-compat.
     */
    readonly sent: boolean
  }
  /**
   * Earliest shoot date, or null if none is set. Used only to gate the casting
   * priority by proximity.
   */
  readonly shootDate: Date | null
}

export interface NextAction {
  /** Machine-readable branch key (stable for tests / analytics). */
  readonly label:
    | "unbooked-casting-near-shoot"
    | "missing-samples"
    | "unsent-callsheet"
    | "build-shot-list"
  /** Human-readable sentence describing the gap and why it matters. */
  readonly message: string
  /** Primary button copy. */
  readonly ctaText: string
  /** Absolute route the primary button navigates to. */
  readonly ctaTo: string
}

const MS_PER_DAY = 1000 * 60 * 60 * 24

/**
 * Whole-day count from `now` until `shootDate` (negative once the shoot has
 * passed). Compared against the lock window to decide casting urgency.
 */
function daysUntil(shootDate: Date, now: Date): number {
  return Math.ceil((shootDate.getTime() - now.getTime()) / MS_PER_DAY)
}

export function computeNextAction(
  input: NextActionInput,
  now: Date = new Date(),
): NextAction | null {
  const { projectId, shotCounts, casting, samples, schedule, shootDate } = input

  // 1. Unbooked casting with the shoot inside the lock window.
  if (casting.unbooked > 0 && shootDate) {
    const days = daysUntil(shootDate, now)
    if (days >= 0 && days <= CASTING_LOCK_WINDOW_DAYS) {
      const roleWord = casting.unbooked === 1 ? "role" : "roles"
      const dayWord = days === 1 ? "day" : "days"
      return {
        label: "unbooked-casting-near-shoot",
        message: `Casting still has ${casting.unbooked} ${roleWord} unbooked with ${days} ${dayWord} to go. Lock talent so wardrobe and the call sheet can finalize.`,
        ctaText: "Open Casting",
        ctaTo: `/projects/${projectId}/casting`,
      }
    }
  }

  // 2. Product samples not yet arrived.
  if (samples.missing > 0) {
    const sampleWord = samples.missing === 1 ? "sample" : "samples"
    return {
      label: "missing-samples",
      message: `${samples.missing} ${sampleWord} still ${samples.missing === 1 ? "hasn't" : "haven't"} arrived. Chase the pulls so every product is ready to shoot.`,
      ctaText: "Open Pulls",
      ctaTo: `/projects/${projectId}/pulls`,
    }
  }

  // 3. Call sheet missing or not yet sent.
  if (!schedule.hasCallSheet || !schedule.sent) {
    const message = schedule.hasCallSheet
      ? "The call sheet is still a draft. Review and send it so crew and talent get their details."
      : "No call sheet yet. Build the shoot-day schedule so the day can be distributed."
    return {
      label: "unsent-callsheet",
      message,
      ctaText: schedule.hasCallSheet ? "Open Call Sheet" : "Build Call Sheet",
      ctaTo: `/projects/${projectId}/callsheet`,
    }
  }

  // 4. No shots drafted yet.
  const totalShots =
    shotCounts.todo +
    shotCounts.in_progress +
    shotCounts.on_hold +
    shotCounts.complete
  if (totalShots === 0) {
    return {
      label: "build-shot-list",
      message:
        "This project has no shots yet. Build the shot list to start planning the shoot.",
      ctaText: "Build Shot List",
      ctaTo: `/projects/${projectId}/shots`,
    }
  }

  // Nothing actionable.
  return null
}
