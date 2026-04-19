/**
 * Firestore path builders for the publishing feature (Phase 3).
 *
 * Root-level collection — share docs are intentionally NOT nested under
 * `clients/{clientId}/…` because the public reader is unauthenticated and
 * cannot know the client scope. See `shared/lib/paths.ts` for thin re-exports
 * and collection-group helpers.
 */

const ROOT_COLLECTION = "callSheetShares"
const RECIPIENTS_SUBCOLLECTION = "recipients"

/** `/callSheetShares` — root-level collection. */
export const callSheetSharesPath = (): string[] => [ROOT_COLLECTION]

/** `/callSheetShares/{shareGroupId}` — one publish record. */
export const callSheetShareDocPath = (shareGroupId: string): string[] => [
  ROOT_COLLECTION,
  shareGroupId,
]

/** `/callSheetShares/{shareGroupId}/recipients` — one doc per recipient. */
export const callSheetShareRecipientsPath = (
  shareGroupId: string,
): string[] => [ROOT_COLLECTION, shareGroupId, RECIPIENTS_SUBCOLLECTION]

/**
 * `/callSheetShares/{shareGroupId}/recipients/{recipientToken}` — the doc
 * the public reader fetches directly. Doc id IS the recipient token.
 */
export const callSheetShareRecipientDocPath = (
  shareGroupId: string,
  recipientToken: string,
): string[] => [
  ROOT_COLLECTION,
  shareGroupId,
  RECIPIENTS_SUBCOLLECTION,
  recipientToken,
]

/**
 * Collection-group id for queries that span all `recipients` subcollections
 * across every share — used by admin dashboards and reminder automation.
 */
export const callSheetShareRecipientsCollectionGroup = (): string =>
  RECIPIENTS_SUBCOLLECTION
