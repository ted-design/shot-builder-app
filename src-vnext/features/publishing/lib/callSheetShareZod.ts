/**
 * Zod mirrors of the `CallSheetShare*` TS types.
 *
 * The public reader (sub-phase 3.4) will zod-parse every payload it reads out
 * of Firestore before rendering — the token is anonymous input and the snapshot
 * is denormalized user content, so shape validation is a must.
 *
 * Cloud Functions (sub-phase 3.1) will zod-parse the request payloads defined
 * below before acting on them.
 */

import { z } from "zod"
import { Timestamp } from "firebase/firestore"

// --- Utility schemas -------------------------------------------------------

/**
 * Firebase Timestamp — accept either a Timestamp instance or a plain
 * `{seconds, nanoseconds}` shape so parsed results from REST responses
 * (which arrive as plain objects) validate identically to SDK reads.
 */
const timestampSchema = z.custom<Timestamp>(
  (val) => {
    if (val instanceof Timestamp) return true
    if (
      typeof val === "object" &&
      val !== null &&
      typeof (val as { seconds?: unknown }).seconds === "number" &&
      typeof (val as { nanoseconds?: unknown }).nanoseconds === "number"
    ) {
      return true
    }
    return false
  },
  { message: "Expected a Firestore Timestamp" },
)

const nullableTimestamp = timestampSchema.nullable()

// --- Snapshot --------------------------------------------------------------

const snapshotSectionSchema = z.object({
  key: z.string(),
  type: z.string(),
  title: z.string().nullable(),
  visible: z.boolean(),
  fields: z.array(
    z.object({
      key: z.string(),
      value: z.unknown(),
    }),
  ),
})

const dayDetailsSnapshotSchema = z.object({
  generalCallTime: z.string().nullable(),
  sunrise: z.string().nullable(),
  sunset: z.string().nullable(),
  weatherSummary: z.string().nullable(),
  notes: z.string().nullable(),
})

const scheduleEntrySnapshotSchema = z.object({
  id: z.string(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  title: z.string(),
  trackLabel: z.string().nullable(),
  locationLabel: z.string().nullable(),
})

const scheduleSnapshotSchema = z.object({
  tracks: z.array(z.object({ id: z.string(), label: z.string() })),
  entries: z.array(scheduleEntrySnapshotSchema),
})

const talentCallSnapshotSchema = z.object({
  talentId: z.string().nullable(),
  name: z.string(),
  roleLabel: z.string().nullable(),
  callTime: z.string().nullable(),
  precallTime: z.string().nullable(),
  wardrobeCall: z.string().nullable(),
  makeupCall: z.string().nullable(),
  onSetCall: z.string().nullable(),
  notes: z.string().nullable(),
})

const crewCallSnapshotSchema = z.object({
  crewMemberId: z.string().nullable(),
  name: z.string(),
  roleLabel: z.string().nullable(),
  departmentLabel: z.string().nullable(),
  callTime: z.string().nullable(),
  precallTime: z.string().nullable(),
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
})

const clientCallSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  company: z.string().nullable(),
  roleLabel: z.string().nullable(),
  callTime: z.string().nullable(),
})

const locationSnapshotSchema = z.object({
  id: z.string().nullable(),
  label: z.string(),
  address: z.string().nullable(),
  notes: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
})

export const callSheetShareSnapshotSchema = z.object({
  title: z.string().min(1).max(500),
  date: nullableTimestamp,
  sections: z.array(snapshotSectionSchema),
  dayDetails: dayDetailsSnapshotSchema.nullable(),
  schedule: scheduleSnapshotSchema.nullable(),
  talentCalls: z.array(talentCallSnapshotSchema),
  crewCalls: z.array(crewCallSnapshotSchema),
  clientCalls: z.array(clientCallSnapshotSchema),
  locations: z.array(locationSnapshotSchema),
  projectName: z.string().min(1).max(500),
  clientName: z.string().min(1).max(500),
  brand: z.object({
    logoUrl: z.string().nullable(),
    primaryColor: z.string().nullable(),
  }),
})

// --- Share doc -------------------------------------------------------------

export const callSheetShareSchema = z.object({
  id: z.string().min(1),
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  scheduleId: z.string().min(1),
  callSheetConfigId: z.string().min(1),
  createdAt: timestampSchema,
  createdBy: z.string().min(1),
  enabled: z.boolean(),
  expiresAt: nullableTimestamp,
  shootDate: nullableTimestamp,
  snapshot: callSheetShareSnapshotSchema,
  emailSubject: z.string().min(1).max(500),
  emailMessage: z.string().max(5000).nullable(),
  requireConfirm: z.boolean(),
  recipientCount: z.number().int().min(0),
  viewedCount: z.number().int().min(0),
  confirmedCount: z.number().int().min(0),
})

// --- Recipient doc ---------------------------------------------------------

const recipientKindSchema = z.enum(["talent", "crew", "client", "adhoc"])

export const callSheetShareRecipientSchema = z.object({
  id: z.string().min(1),
  shareGroupId: z.string().min(1),
  personId: z.string().nullable(),
  personKind: recipientKindSchema,
  name: z.string().min(1).max(200),
  roleLabel: z.string().max(200).nullable(),
  email: z.string().email(),
  phone: z.string().max(50).nullable(),
  callTime: z.string().max(50).nullable(),
  precallTime: z.string().max(50).nullable(),
  channel: z.literal("email"),
  emailSentAt: nullableTimestamp,
  emailSendError: z.string().max(2000).nullable(),
  emailSendAttempts: z.number().int().min(0),
  viewCount: z.number().int().min(0),
  firstViewedAt: nullableTimestamp,
  lastViewedAt: nullableTimestamp,
  isConfirmed: z.boolean(),
  confirmedAt: nullableTimestamp,
  confirmIpHash: z.string().max(128).nullable(),
  createdAt: timestampSchema,
  revokedAt: nullableTimestamp,
})

// --- Cloud Function request shapes ----------------------------------------

const publishRecipientInputSchema = z.object({
  personId: z.string().nullable(),
  personKind: recipientKindSchema,
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).nullable().optional(),
  roleLabel: z.string().max(200).nullable().optional(),
  callTime: z.string().max(50).nullable().optional(),
  precallTime: z.string().max(50).nullable().optional(),
})

export const publishCallSheetRequestSchema = z.object({
  clientId: z.string().min(1),
  projectId: z.string().min(1),
  scheduleId: z.string().min(1),
  callSheetConfigId: z.string().min(1),
  emailSubject: z.string().min(1).max(500),
  emailMessage: z.string().max(5000).nullable(),
  requireConfirm: z.boolean(),
  recipients: z.array(publishRecipientInputSchema).min(1),
  publishAttemptId: z.string().min(1).max(128),
})

/**
 * Compound token used by the public reader: `{shareGroupId}.{recipientToken}`.
 * Enforces presence of a single `.` separator and non-empty halves so malformed
 * tokens are rejected at the edge before hitting Firestore.
 */
const compoundTokenSchema = z
  .string()
  .min(3)
  .max(256)
  .refine(
    (s) => {
      const dot = s.indexOf(".")
      if (dot <= 0 || dot === s.length - 1) return false
      // Exactly one dot separator — reject tokens with multiple.
      if (s.indexOf(".", dot + 1) !== -1) return false
      return true
    },
    { message: "token must be of the form {shareGroupId}.{recipientToken}" },
  )

export const recordCallSheetShareViewRequestSchema = z.object({
  token: compoundTokenSchema,
})

export const confirmCallSheetShareRequestSchema = z.object({
  token: compoundTokenSchema,
  /** Q6 = A: only `true` is accepted; unconfirms must go through the producer. */
  confirm: z.literal(true),
})

// --- Parse helpers ---------------------------------------------------------

/**
 * Split a compound reader token into `{shareGroupId, recipientToken}` halves.
 * Returns `null` when the token fails shape validation.
 */
export function parseCompoundToken(
  token: string,
): { shareGroupId: string; recipientToken: string } | null {
  const result = compoundTokenSchema.safeParse(token)
  if (!result.success) return null
  const dot = token.indexOf(".")
  return {
    shareGroupId: token.slice(0, dot),
    recipientToken: token.slice(dot + 1),
  }
}
