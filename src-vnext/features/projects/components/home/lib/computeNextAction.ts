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
 *   3. empty project — no call sheet AND no shots, so BOTH first build steps
 *      legitimately apply. There is no one right order ("it's different each
 *      time"), so we don't force one: the action carries a primary CTA plus an
 *      equal-weight `alternate`, and the bar lets the user choose.
 *   4. unsent / no call sheet — the schedule is not ready to distribute.
 *   5. build shot list — a call sheet exists but the project still has no shots,
 *      so the next move is to draft the list.
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

/**
 * A single navigable choice: button copy + the absolute route it links to.
 *
 * NOTE: unlike `NextAction`, this has no machine-readable `label`. The bar is
 * navigation-only today, so none is needed. If click-tracking is ever wired up,
 * add a `label` here so an alternate-CTA click can emit a stable analytics key.
 */
export interface NextActionLink {
  /** Button / link copy. */
  readonly ctaText: string
  /** Absolute route to navigate to. */
  readonly ctaTo: string
}

export interface NextAction {
  /** Machine-readable branch key (stable for tests / analytics). */
  readonly label:
    | "unbooked-casting-near-shoot"
    | "missing-samples"
    | "empty-project"
    | "unsent-callsheet"
    | "build-shot-list"
  /** Human-readable sentence describing the gap and why it matters. */
  readonly message: string
  /** Primary button copy. */
  readonly ctaText: string
  /** Absolute route the primary button navigates to. */
  readonly ctaTo: string
  /**
   * Optional equal-weight second choice, rendered as "or {ctaText}" beside the
   * primary CTA. Present only when two next steps apply at once and we want the
   * user to pick rather than forcing one (today: the empty-project case).
   */
  readonly alternate?: NextActionLink
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

  const totalShots =
    shotCounts.todo +
    shotCounts.in_progress +
    shotCounts.on_hold +
    shotCounts.complete

  // 3. Empty project: no call sheet AND no shots, so the shot list and the call
  //    sheet are both valid first moves. There's no fixed right order, so offer
  //    both and let the user choose (primary CTA + equal-weight alternate)
  //    rather than forcing one. Shot list leads because it's the natural first
  //    creative step, but the call sheet is one click away as the alternate.
  if (!schedule.hasCallSheet && totalShots === 0) {
    return {
      label: "empty-project",
      message:
        "This project is empty. Build the shot list to plan the shoot, or start the call sheet for the day — whichever you want to tackle first.",
      ctaText: "Build Shot List",
      ctaTo: `/projects/${projectId}/shots`,
      alternate: {
        ctaText: "Build Call Sheet",
        ctaTo: `/projects/${projectId}/callsheet`,
      },
    }
  }

  // 4. Call sheet missing or not yet sent.
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

  // 5. Call sheet exists but no shots drafted yet.
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
