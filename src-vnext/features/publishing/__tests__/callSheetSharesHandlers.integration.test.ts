// @vitest-environment node
/**
 * Integration tests for `functions/src/callSheetShares.js` (Phase 3
 * publishing). Exercises the Firestore write paths for the view + confirm +
 * resend + revoke handlers against the Firestore emulator.
 *
 * Skipped when FIRESTORE_EMULATOR_HOST is unset, matching the sub-phase 3.0
 * rules-test posture: auto-skip locally without Java, run in CI.
 *
 * The publishCallSheet end-to-end test would need `firebase-admin.auth()` +
 * a set of seeded upstream callSheet/config/schedule docs; it is covered by
 * the thinner unit tests in `callSheetSharesHandlers.test.ts` for this
 * sub-phase. Full publish happy-path integration is tracked for sub-phase
 * 3.5 (E2E).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const require = createRequire(import.meta.url)

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const skipSuite = !EMULATOR_HOST
const describeOrSkip = skipSuite ? describe.skip : describe

const PROJECT_ID = "demo-callsheet-handlers"

// Modules are required lazily inside beforeAll so the describe.skip path
// does not import firebase-admin when the emulator is unavailable.
let admin: typeof import("firebase-admin")
let handlers: {
  handleRecordCallSheetShareView: (data: { token: string }) => Promise<{
    ok: boolean
    throttled: boolean
  }>
  handleConfirmCallSheetShare: (
    data: { token: string; confirm: true },
    meta: { ip: string },
  ) => Promise<{ ok: boolean; alreadyConfirmed: boolean }>
  handleRevokeCallSheetShare: (
    data: { shareGroupId: string; tokens?: string[] },
    caller: { uid: string; role: string; clientId: string },
  ) => Promise<{ shareGroupId: string; revokedAll: boolean; revoked?: string[] }>
  handleResendCallSheetShare: (
    data: { shareGroupId: string; tokens: string[]; reason?: string },
    caller: { uid: string; role: string; clientId: string },
  ) => Promise<{ shareGroupId: string; attempted: number; failedSends: number }>
}

const CLIENT_ID = "client-handlers"
const PUBLISHER_UID = "publisher-uid"

function makeSnapshot() {
  return {
    title: "Day 3",
    date: null,
    sections: [],
    dayDetails: null,
    schedule: null,
    talentCalls: [],
    crewCalls: [],
    clientCalls: [],
    locations: [],
    projectName: "Project",
    clientName: "Client",
    brand: { logoUrl: null, primaryColor: null },
  }
}

async function seedShareWithRecipient({
  shareId,
  recipientId,
  enabled = true,
  revoked = false,
  confirmed = false,
}: {
  shareId: string
  recipientId: string
  enabled?: boolean
  revoked?: boolean
  confirmed?: boolean
}) {
  const db = admin.firestore()
  const shootDate = admin.firestore.Timestamp.fromMillis(Date.now() + 86_400_000)
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    Date.now() + 14 * 86_400_000,
  )
  await db.collection("callSheetShares").doc(shareId).set({
    clientId: CLIENT_ID,
    projectId: "proj-1",
    scheduleId: "sched-1",
    callSheetConfigId: "cfg-1",
    publishAttemptId: `attempt-${shareId}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: PUBLISHER_UID,
    enabled,
    expiresAt,
    shootDate,
    snapshot: makeSnapshot(),
    emailSubject: "Subject",
    emailMessage: null,
    requireConfirm: true,
    recipientCount: 1,
    viewedCount: 0,
    confirmedCount: confirmed ? 1 : 0,
  })
  await db
    .collection("callSheetShares")
    .doc(shareId)
    .collection("recipients")
    .doc(recipientId)
    .set({
      shareGroupId: shareId,
      personId: "person-1",
      personKind: "talent",
      name: "Jane Doe",
      roleLabel: "Lead",
      email: "jane@example.test",
      phone: null,
      callTime: null,
      precallTime: null,
      channel: "email",
      emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      emailSendError: null,
      emailSendAttempts: 1,
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      isConfirmed: confirmed,
      confirmedAt: confirmed ? admin.firestore.Timestamp.now() : null,
      confirmIpHash: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      revokedAt: revoked ? admin.firestore.Timestamp.now() : null,
    })
}

describeOrSkip("callSheetShares handlers — Firestore emulator", () => {
  beforeAll(async () => {
    admin = require("firebase-admin")
    if (!admin.apps.length) {
      admin.initializeApp({ projectId: PROJECT_ID })
    }
    handlers = require(
      resolve(__dirname, "../../../../functions/src/callSheetShares.js"),
    )
  })

  afterAll(async () => {
    if (admin?.apps?.length) {
      await Promise.all(admin.apps.map((app) => app?.delete()))
    }
  })

  beforeEach(async () => {
    // Reset the emulator's Firestore state between tests by deleting every
    // callSheetShares doc we seeded.
    const db = admin.firestore()
    const shares = await db.collection("callSheetShares").listDocuments()
    await Promise.all(
      shares.map(async (shareRef) => {
        const recipients = await shareRef.collection("recipients").listDocuments()
        await Promise.all(recipients.map((r) => r.delete()))
        await shareRef.delete()
      }),
    )
  })

  describe("handleRecordCallSheetShareView", () => {
    it("increments viewCount and sets firstViewedAt on first view", async () => {
      await seedShareWithRecipient({ shareId: "s1", recipientId: "r1" })
      const result = await handlers.handleRecordCallSheetShareView({
        token: "s1.r1",
      })
      expect(result.ok).toBe(true)
      expect(result.throttled).toBe(false)

      const recipient = await admin
        .firestore()
        .doc("callSheetShares/s1/recipients/r1")
        .get()
      const data = recipient.data()!
      expect(data.viewCount).toBe(1)
      expect(data.firstViewedAt).not.toBeNull()
      expect(data.lastViewedAt).not.toBeNull()

      const share = await admin.firestore().doc("callSheetShares/s1").get()
      expect(share.data()!.viewedCount).toBe(1)
    })

    it("throttles rapid views within 10s window", async () => {
      await seedShareWithRecipient({ shareId: "s2", recipientId: "r2" })
      await handlers.handleRecordCallSheetShareView({ token: "s2.r2" })
      const second = await handlers.handleRecordCallSheetShareView({
        token: "s2.r2",
      })
      expect(second.throttled).toBe(true)

      const recipient = await admin
        .firestore()
        .doc("callSheetShares/s2/recipients/r2")
        .get()
      expect(recipient.data()!.viewCount).toBe(1)
    })

    it("throws not-found for an unknown token", async () => {
      await expect(
        handlers.handleRecordCallSheetShareView({ token: "missing.gone" }),
      ).rejects.toThrow(/Share not found/)
    })

    it("rejects malformed token", async () => {
      await expect(
        handlers.handleRecordCallSheetShareView({ token: "no-dot" }),
      ).rejects.toThrow(/Invalid token/)
    })

    it("rejects view on disabled share", async () => {
      await seedShareWithRecipient({
        shareId: "s3",
        recipientId: "r3",
        enabled: false,
      })
      await expect(
        handlers.handleRecordCallSheetShareView({ token: "s3.r3" }),
      ).rejects.toThrow(/revoked/)
    })

    it("rejects view on revoked recipient", async () => {
      await seedShareWithRecipient({
        shareId: "s4",
        recipientId: "r4",
        revoked: true,
      })
      await expect(
        handlers.handleRecordCallSheetShareView({ token: "s4.r4" }),
      ).rejects.toThrow(/revoked/)
    })
  })

  describe("handleConfirmCallSheetShare", () => {
    it("flips isConfirmed and increments confirmedCount", async () => {
      await seedShareWithRecipient({ shareId: "sc1", recipientId: "rc1" })
      const result = await handlers.handleConfirmCallSheetShare(
        { token: "sc1.rc1", confirm: true },
        { ip: "192.0.2.1" },
      )
      expect(result.ok).toBe(true)
      expect(result.alreadyConfirmed).toBe(false)

      const recipient = await admin
        .firestore()
        .doc("callSheetShares/sc1/recipients/rc1")
        .get()
      const data = recipient.data()!
      expect(data.isConfirmed).toBe(true)
      expect(data.confirmedAt).not.toBeNull()
      expect(typeof data.confirmIpHash).toBe("string")
      expect(data.confirmIpHash).toHaveLength(64)

      const share = await admin.firestore().doc("callSheetShares/sc1").get()
      expect(share.data()!.confirmedCount).toBe(1)
    })

    it("no-ops on already-confirmed recipient (Q6=A)", async () => {
      await seedShareWithRecipient({
        shareId: "sc2",
        recipientId: "rc2",
        confirmed: true,
      })
      const result = await handlers.handleConfirmCallSheetShare(
        { token: "sc2.rc2", confirm: true },
        { ip: "192.0.2.1" },
      )
      expect(result.alreadyConfirmed).toBe(true)

      // confirmedCount should NOT be incremented on the duplicate confirm.
      const share = await admin.firestore().doc("callSheetShares/sc2").get()
      expect(share.data()!.confirmedCount).toBe(1)
    })

    it("rejects confirm:false", async () => {
      await seedShareWithRecipient({ shareId: "sc3", recipientId: "rc3" })
      await expect(
        handlers.handleConfirmCallSheetShare(
          { token: "sc3.rc3", confirm: false as unknown as true },
          { ip: "192.0.2.1" },
        ),
      ).rejects.toThrow(/confirm must be true/)
    })
  })

  describe("handleRevokeCallSheetShare", () => {
    it("flips enabled=false on whole-share revoke (no tokens)", async () => {
      await seedShareWithRecipient({ shareId: "sr1", recipientId: "rr1" })
      const result = await handlers.handleRevokeCallSheetShare(
        { shareGroupId: "sr1" },
        { uid: PUBLISHER_UID, role: "producer", clientId: CLIENT_ID },
      )
      expect(result.revokedAll).toBe(true)

      const share = await admin.firestore().doc("callSheetShares/sr1").get()
      expect(share.data()!.enabled).toBe(false)
    })

    it("per-recipient revoke sets revokedAt on selected rows", async () => {
      await seedShareWithRecipient({ shareId: "sr2", recipientId: "rr2a" })
      await admin
        .firestore()
        .doc("callSheetShares/sr2/recipients/rr2b")
        .set({
          shareGroupId: "sr2",
          personId: null,
          personKind: "adhoc",
          name: "Bob",
          email: "bob@x.com",
          roleLabel: null,
          phone: null,
          callTime: null,
          precallTime: null,
          channel: "email",
          emailSentAt: null,
          emailSendError: null,
          emailSendAttempts: 0,
          viewCount: 0,
          firstViewedAt: null,
          lastViewedAt: null,
          isConfirmed: false,
          confirmedAt: null,
          confirmIpHash: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          revokedAt: null,
        })

      const result = await handlers.handleRevokeCallSheetShare(
        { shareGroupId: "sr2", tokens: ["rr2a"] },
        { uid: PUBLISHER_UID, role: "producer", clientId: CLIENT_ID },
      )
      expect(result.revokedAll).toBe(false)
      expect(result.revoked).toEqual(["rr2a"])

      const revoked = await admin
        .firestore()
        .doc("callSheetShares/sr2/recipients/rr2a")
        .get()
      const untouched = await admin
        .firestore()
        .doc("callSheetShares/sr2/recipients/rr2b")
        .get()
      expect(revoked.data()!.revokedAt).not.toBeNull()
      expect(untouched.data()!.revokedAt).toBeNull()
    })

    it("rejects revoke by caller from different client", async () => {
      await seedShareWithRecipient({ shareId: "sr3", recipientId: "rr3" })
      await expect(
        handlers.handleRevokeCallSheetShare(
          { shareGroupId: "sr3" },
          {
            uid: "other-uid",
            role: "producer",
            clientId: "other-client",
          },
        ),
      ).rejects.toThrow(/access/i)
    })

    it("whole-share revoke is idempotent", async () => {
      await seedShareWithRecipient({
        shareId: "sr4",
        recipientId: "rr4",
        enabled: false,
      })
      const result = await handlers.handleRevokeCallSheetShare(
        { shareGroupId: "sr4" },
        { uid: PUBLISHER_UID, role: "producer", clientId: CLIENT_ID },
      )
      expect(result).toMatchObject({ revokedAll: true })
    })
  })

  describe("handleResendCallSheetShare", () => {
    it("increments emailSendAttempts on each target recipient", async () => {
      // Ensure RESEND_API_KEY is unset so the email module returns
      // ok:false but the handler still updates the recipient row.
      const prev = process.env.RESEND_API_KEY
      delete process.env.RESEND_API_KEY
      try {
        await seedShareWithRecipient({ shareId: "sx1", recipientId: "rx1" })
        const result = await handlers.handleResendCallSheetShare(
          { shareGroupId: "sx1", tokens: ["rx1"] },
          { uid: PUBLISHER_UID, role: "producer", clientId: CLIENT_ID },
        )
        expect(result.attempted).toBe(1)
        const recipient = await admin
          .firestore()
          .doc("callSheetShares/sx1/recipients/rx1")
          .get()
        expect(recipient.data()!.emailSendAttempts).toBeGreaterThan(0)
      } finally {
        if (prev !== undefined) process.env.RESEND_API_KEY = prev
      }
    })

    it("rejects resend by caller from different client", async () => {
      await seedShareWithRecipient({ shareId: "sx2", recipientId: "rx2" })
      await expect(
        handlers.handleResendCallSheetShare(
          { shareGroupId: "sx2", tokens: ["rx2"] },
          { uid: "other", role: "producer", clientId: "other-client" },
        ),
      ).rejects.toThrow(/access/i)
    })

    it("rejects empty tokens array", async () => {
      await seedShareWithRecipient({ shareId: "sx3", recipientId: "rx3" })
      await expect(
        handlers.handleResendCallSheetShare(
          { shareGroupId: "sx3", tokens: [] },
          { uid: PUBLISHER_UID, role: "producer", clientId: CLIENT_ID },
        ),
      ).rejects.toThrow(/At least one recipient token/)
    })
  })
})
