// @vitest-environment node
/**
 * Firestore rules tests for Phase 3 publishing callSheetShares +
 * recipients subcollection.
 *
 * Covers the seven cases from plan §8 sub-phase 3.0:
 *   1. Anonymous GET succeeds on enabled + non-expired share's recipient doc.
 *   2. Anonymous GET fails on disabled share.
 *   3. Anonymous GET fails on expired share.
 *   4. Anonymous LIST on callSheetShares / recipients fails.
 *   5. Authed producer GET succeeds scoped by clientId.
 *   6. Authed producer from different clientId GET fails.
 *   7. Direct WRITE denied for all callers (CF path only).
 *
 * Requires the Firestore emulator. When \`FIRESTORE_EMULATOR_HOST\` is not
 * set, the suite is skipped so \`CI=1 npm test -- --run\` stays green on
 * developer machines without a running emulator. CI (ui-checks.yml) starts
 * the emulator on port 8080 and sets the host, so these tests run there.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  Timestamp,
} from "firebase/firestore"

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const skipSuite = !EMULATOR_HOST
const describeOrSkip = skipSuite ? describe.skip : describe

const PROJECT_ID = "demo-callsheet-rules"
const RULES_PATH = resolve(__dirname, "../../../../firestore.rules")

const CLIENT_A = "client-a"
const CLIENT_B = "client-b"
const SHARE_ID_OK = "share-ok"
const SHARE_ID_DISABLED = "share-disabled"
const SHARE_ID_EXPIRED = "share-expired"
const RECIPIENT_TOKEN = "tok-recipient-1"

function inFuture(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * 86_400_000)
}

function inPast(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * 86_400_000)
}

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

function makeShare(
  overrides: {
    clientId?: string
    enabled?: boolean
    expiresAt?: Timestamp | null
  } = {},
) {
  return {
    clientId: overrides.clientId ?? CLIENT_A,
    projectId: "proj-1",
    scheduleId: "sched-1",
    callSheetConfigId: "cfg-1",
    createdAt: Timestamp.now(),
    createdBy: "publisher-uid",
    enabled: overrides.enabled ?? true,
    expiresAt: overrides.expiresAt === undefined ? inFuture(14) : overrides.expiresAt,
    shootDate: inFuture(1),
    snapshot: makeSnapshot(),
    emailSubject: "Subject",
    emailMessage: null,
    requireConfirm: true,
    recipientCount: 1,
    viewedCount: 0,
    confirmedCount: 0,
  }
}

function makeRecipient(shareGroupId: string) {
  return {
    id: RECIPIENT_TOKEN,
    shareGroupId,
    personId: "person-1",
    personKind: "talent",
    name: "Jane Doe",
    roleLabel: "Lead",
    email: "jane@example.com",
    phone: null,
    callTime: null,
    precallTime: null,
    channel: "email",
    emailSentAt: Timestamp.now(),
    emailSendError: null,
    emailSendAttempts: 1,
    viewCount: 0,
    firstViewedAt: null,
    lastViewedAt: null,
    isConfirmed: false,
    confirmedAt: null,
    confirmIpHash: null,
    createdAt: Timestamp.now(),
    revokedAt: null,
  }
}

let testEnv: RulesTestEnvironment | null = null

describeOrSkip("firestore.rules — callSheetShares + recipients", () => {
  beforeAll(async () => {
    if (!EMULATOR_HOST) return
    const [host, portStr] = EMULATOR_HOST.split(":")
    const port = Number(portStr || "8080")
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host,
        port,
        rules: readFileSync(RULES_PATH, "utf8"),
      },
    })

    // Seed data using the admin bypass context.
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      await setDoc(doc(db, "callSheetShares", SHARE_ID_OK), makeShare())
      await setDoc(
        doc(db, "callSheetShares", SHARE_ID_OK, "recipients", RECIPIENT_TOKEN),
        makeRecipient(SHARE_ID_OK),
      )

      await setDoc(
        doc(db, "callSheetShares", SHARE_ID_DISABLED),
        makeShare({ enabled: false }),
      )
      await setDoc(
        doc(
          db,
          "callSheetShares",
          SHARE_ID_DISABLED,
          "recipients",
          RECIPIENT_TOKEN,
        ),
        makeRecipient(SHARE_ID_DISABLED),
      )

      await setDoc(
        doc(db, "callSheetShares", SHARE_ID_EXPIRED),
        makeShare({ expiresAt: inPast(1) }),
      )
      await setDoc(
        doc(
          db,
          "callSheetShares",
          SHARE_ID_EXPIRED,
          "recipients",
          RECIPIENT_TOKEN,
        ),
        makeRecipient(SHARE_ID_EXPIRED),
      )
    })
  })

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  it("[1] anonymous GET succeeds on enabled + non-expired recipient doc", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertSucceeds(
      getDoc(
        doc(db, "callSheetShares", SHARE_ID_OK, "recipients", RECIPIENT_TOKEN),
      ),
    )
  })

  it("[2] anonymous GET fails on recipient under a disabled share", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(
      getDoc(
        doc(
          db,
          "callSheetShares",
          SHARE_ID_DISABLED,
          "recipients",
          RECIPIENT_TOKEN,
        ),
      ),
    )
  })

  it("[3] anonymous GET fails on recipient under an expired share", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(
      getDoc(
        doc(
          db,
          "callSheetShares",
          SHARE_ID_EXPIRED,
          "recipients",
          RECIPIENT_TOKEN,
        ),
      ),
    )
  })

  it("[4a] anonymous LIST on callSheetShares fails", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(getDocs(collection(db, "callSheetShares")))
  })

  it("[4b] anonymous LIST on recipients subcollection fails", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(
      getDocs(collection(db, "callSheetShares", SHARE_ID_OK, "recipients")),
    )
  })

  it("[5] authed producer GET succeeds when clientId matches", async () => {
    const db = testEnv!
      .authenticatedContext("producer-a", {
        clientId: CLIENT_A,
        role: "producer",
      })
      .firestore()
    await assertSucceeds(getDoc(doc(db, "callSheetShares", SHARE_ID_OK)))
  })

  it("[6] authed producer from a different clientId GET fails", async () => {
    const db = testEnv!
      .authenticatedContext("producer-b", {
        clientId: CLIENT_B,
        role: "producer",
      })
      .firestore()
    // Client-A's share is anon-GET-allowed (enabled + not expired), so to
    // verify the cross-tenant authed check bites we use the disabled share
    // which has no anon-GET fallback. A producer from client-B must fail.
    await assertFails(
      getDoc(doc(db, "callSheetShares", SHARE_ID_DISABLED)),
    )
  })

  it("[7a] direct WRITE to callSheetShares denied for anonymous", async () => {
    const db = testEnv!.unauthenticatedContext().firestore()
    await assertFails(
      setDoc(doc(db, "callSheetShares", "new-share"), makeShare()),
    )
  })

  it("[7b] direct WRITE to callSheetShares denied for authed producer", async () => {
    const db = testEnv!
      .authenticatedContext("producer-a", {
        clientId: CLIENT_A,
        role: "producer",
      })
      .firestore()
    await assertFails(
      setDoc(doc(db, "callSheetShares", "new-share-2"), makeShare()),
    )
  })

  it("[7c] direct WRITE to recipients subcollection denied for authed producer", async () => {
    const db = testEnv!
      .authenticatedContext("producer-a", {
        clientId: CLIENT_A,
        role: "producer",
      })
      .firestore()
    await assertFails(
      setDoc(
        doc(
          db,
          "callSheetShares",
          SHARE_ID_OK,
          "recipients",
          "new-recipient",
        ),
        makeRecipient(SHARE_ID_OK),
      ),
    )
  })
})

// Ensure the skip notice is visible in test output so developers know why
// zero rules tests ran locally.
if (skipSuite) {
  describe("firestore.rules — callSheetShares + recipients (skipped)", () => {
    it("skipped: set FIRESTORE_EMULATOR_HOST to run rules unit tests", () => {
      expect(skipSuite).toBe(true)
    })
  })
}
