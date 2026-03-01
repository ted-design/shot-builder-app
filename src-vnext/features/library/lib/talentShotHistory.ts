/**
 * Type definitions for talent shot history.
 *
 * A lightweight projection of Shot documents for display on the talent
 * detail page. Keeps only the fields needed for history rendering.
 */

export interface TalentShotHistoryEntry {
  readonly shotId: string
  readonly projectId: string
  readonly projectName: string
  readonly shotTitle: string
  readonly shotNumber: string | null
  readonly shotStatus: string
  readonly heroImageUrl: string | null
  readonly shootDate: string | null
  readonly updatedAt: Date
}
