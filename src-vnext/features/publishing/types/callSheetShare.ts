/**
 * Phase 3 publishing — data model types.
 *
 * Root-level `callSheetShares/{shareGroupId}` holds a denormalized snapshot of
 * a published call sheet. Each share has a `recipients/{recipientToken}`
 * subcollection with one doc per recipient. The public reader at
 * `/s/:token` treats `token = "{shareGroupId}.{recipientToken}"` as the
 * credential (Q7 = A) and reads the recipient doc directly.
 *
 * See `/Users/tedghanime/.claude/plans/phase-3-publishing.md` §3 for the
 * authoritative schema rationale and §9.2.1 for decision log.
 *
 * This sub-phase (3.0) is scaffold-only: these types exist so sub-phase 3.1
 * (Cloud Functions) can compile against them. No runtime code reads from or
 * writes to these collections yet.
 */

import type { Timestamp } from "firebase/firestore"

// --- Snapshot sub-shapes ---------------------------------------------------

/**
 * Denormalized section from the upstream `CallSheetConfig.sections` at
 * publish time. Visibility is pre-resolved (only visible sections land in
 * the snapshot).
 */
export interface ReadonlySnapshotSection {
  readonly key: string
  readonly type: string
  readonly title: string | null
  readonly visible: boolean
  readonly fields: ReadonlyArray<{ readonly key: string; readonly value: unknown }>
}

export interface ReadonlyDayDetailsSnapshot {
  readonly generalCallTime: string | null
  readonly sunrise: string | null
  readonly sunset: string | null
  readonly weatherSummary: string | null
  readonly notes: string | null
}

export interface ReadonlyScheduleEntrySnapshot {
  readonly id: string
  readonly startTime: string | null
  readonly endTime: string | null
  readonly title: string
  readonly trackLabel: string | null
  readonly locationLabel: string | null
}

export interface ReadonlyScheduleSnapshot {
  readonly tracks: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly entries: ReadonlyArray<ReadonlyScheduleEntrySnapshot>
}

export interface ReadonlyTalentCallSnapshot {
  readonly talentId: string | null
  readonly name: string
  readonly roleLabel: string | null
  readonly callTime: string | null
  readonly precallTime: string | null
  readonly wardrobeCall: string | null
  readonly makeupCall: string | null
  readonly onSetCall: string | null
  readonly notes: string | null
}

export interface ReadonlyCrewCallSnapshot {
  readonly crewMemberId: string | null
  readonly name: string
  readonly roleLabel: string | null
  readonly departmentLabel: string | null
  readonly callTime: string | null
  readonly precallTime: string | null
  readonly showPhone: boolean
  readonly showEmail: boolean
  readonly phone: string | null
  readonly email: string | null
}

export interface ReadonlyClientCallSnapshot {
  readonly id: string
  readonly name: string
  readonly company: string | null
  readonly roleLabel: string | null
  readonly callTime: string | null
}

export interface ReadonlyLocationSnapshot {
  readonly id: string | null
  readonly label: string
  readonly address: string | null
  readonly notes: string | null
  readonly latitude: number | null
  readonly longitude: number | null
}

export interface CallSheetShareSnapshot {
  readonly title: string
  readonly date: Timestamp | null
  readonly sections: ReadonlyArray<ReadonlySnapshotSection>
  readonly dayDetails: ReadonlyDayDetailsSnapshot | null
  readonly schedule: ReadonlyScheduleSnapshot | null
  readonly talentCalls: ReadonlyArray<ReadonlyTalentCallSnapshot>
  readonly crewCalls: ReadonlyArray<ReadonlyCrewCallSnapshot>
  readonly clientCalls: ReadonlyArray<ReadonlyClientCallSnapshot>
  readonly locations: ReadonlyArray<ReadonlyLocationSnapshot>
  readonly projectName: string
  readonly clientName: string
  readonly brand: {
    readonly logoUrl: string | null
    readonly primaryColor: string | null
  }
}

// --- Share doc -------------------------------------------------------------

/**
 * Root-level `callSheetShares/{shareGroupId}` doc.
 *
 * Writes go through Cloud Functions only; client code reads in two modes:
 *   - Authed producer/admin: can get/list scoped by clientId (RecipientsPanel).
 *   - Anonymous public reader: does NOT read this doc directly; it reads the
 *     `recipients/{recipientToken}` subcollection doc and any snapshot fields
 *     echoed into that doc at publish time.
 */
export interface CallSheetShare {
  readonly id: string
  readonly clientId: string
  readonly projectId: string
  readonly scheduleId: string
  readonly callSheetConfigId: string
  readonly createdAt: Timestamp
  readonly createdBy: string
  readonly enabled: boolean
  /** Q2 = B: shoot date + 14 days. `null` means no expiry. */
  readonly expiresAt: Timestamp | null
  readonly shootDate: Timestamp | null
  readonly snapshot: CallSheetShareSnapshot
  readonly emailSubject: string
  readonly emailMessage: string | null
  readonly requireConfirm: boolean
  readonly recipientCount: number
  readonly viewedCount: number
  readonly confirmedCount: number
}

// --- Recipient doc ---------------------------------------------------------

export type CallSheetShareRecipientKind =
  | "talent"
  | "crew"
  | "client"
  | "adhoc"

/** v1 email-only (non-goal: SMS). Field exists so v3-1 can add `'sms'`. */
export type CallSheetShareChannel = "email"

/**
 * `callSheetShares/{shareGroupId}/recipients/{recipientToken}` doc.
 *
 * Doc id = per-recipient random token (Firestore auto-id, ≥20 chars). The
 * public reader compound token is `{shareGroupId}.{recipientToken}`
 * (Q1 = B, Q7 = A).
 */
export interface CallSheetShareRecipient {
  readonly id: string
  readonly shareGroupId: string
  readonly personId: string | null
  readonly personKind: CallSheetShareRecipientKind
  readonly name: string
  readonly roleLabel: string | null
  readonly email: string
  readonly phone: string | null
  readonly callTime: string | null
  readonly precallTime: string | null
  readonly channel: CallSheetShareChannel
  readonly emailSentAt: Timestamp | null
  readonly emailSendError: string | null
  readonly emailSendAttempts: number
  readonly viewCount: number
  readonly firstViewedAt: Timestamp | null
  readonly lastViewedAt: Timestamp | null
  /** Q6 = A: once confirmed, `isConfirmed` cannot flip back to false. */
  readonly isConfirmed: boolean
  readonly confirmedAt: Timestamp | null
  readonly confirmIpHash: string | null
  readonly createdAt: Timestamp
  readonly revokedAt: Timestamp | null
}

// --- Cloud Function request shapes ----------------------------------------

/**
 * Input to `publishCallSheet` queue handler (sub-phase 3.1). `recipients` is
 * the minimal set of fields the client must supply; the handler fans out to
 * create N `recipients/{token}` docs.
 */
export interface PublishCallSheetRecipientInput {
  readonly personId: string | null
  readonly personKind: CallSheetShareRecipientKind
  readonly name: string
  readonly email: string
  readonly phone?: string | null
  readonly roleLabel?: string | null
  readonly callTime?: string | null
  readonly precallTime?: string | null
}

export interface PublishCallSheetRequest {
  readonly clientId: string
  readonly projectId: string
  readonly scheduleId: string
  readonly callSheetConfigId: string
  readonly emailSubject: string
  readonly emailMessage: string | null
  readonly requireConfirm: boolean
  readonly recipients: ReadonlyArray<PublishCallSheetRecipientInput>
  /** Idempotency key; duplicate attemptIds are no-ops. */
  readonly publishAttemptId: string
}

export interface RecordCallSheetShareViewRequest {
  /** Compound token `{shareGroupId}.{recipientToken}` (Q7 = A). */
  readonly token: string
}

export interface ConfirmCallSheetShareRequest {
  readonly token: string
  /** Q6 = A: only `true` is accepted; `false` is rejected by zod. */
  readonly confirm: true
}
