// @vitest-environment node
/**
 * Firestore rules tests for the Capture One digi-tech share (captureOneShares).
 *
 * Covers: anonymous get on enabled/disabled/expired; anonymous list denied;
 * authed admin/producer get scoped by clientId; client-side create/update/delete
 * scoped by clientId; cross-tenant + non-privileged denials.
 *
 * Requires the Firestore emulator. When FIRESTORE_EMULATOR_HOST is not set the
 * suite self-skips so a plain `CI=1 npm test` stays green without an emulator.
 * CI (ui-checks.yml) starts the emulator and runs these via the .rules.test.ts glob.
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
import { deleteDoc, doc, getDoc, collection, getDocs, setDoc, updateDoc, Timestamp } from "firebase/firestore"

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const skipSuite = !EMULATOR_HOST
const describeOrSkip = skipSuite ? describe.skip : describe

const PROJECT_ID = "demo-captureone-rules"
const RULES_PATH = resolve(__dirname, "../../../../firestore.rules")

const CLIENT_A = "client-a"
const CLIENT_B = "client-b"
const PROJ_TEAM = "proj-1" // team-visible -> a global producer auto-has access
const PROJ_PRIVATE = "proj-private" // private -> producer needs an explicit members doc
const SHARE_OK = "share-ok"
const SHARE_DISABLED = "share-disabled"
const SHARE_EXPIRED = "share-expired"
const SHARE_NO_EXPIRY = "share-no-expiry"
const SHARE_DELETABLE = "share-deletable"

function inFuture(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() + days * 86_400_000)
}
function inPast(days: number): Timestamp {
  return Timestamp.fromMillis(Date.now() - days * 86_400_000)
}

function makeShare(
  overrides: {
    clientId?: string
    projectId?: string
    enabled?: boolean
    expiresAt?: Timestamp | null
  } = {},
) {
  return {
    clientId: overrides.clientId ?? CLIENT_A,
    projectId: overrides.projectId ?? PROJ_TEAM,
    title: "Capture One",
    enabled: overrides.enabled ?? true,
    expiresAt: overrides.expiresAt === undefined ? inFuture(14) : overrides.expiresAt,
    createdAt: Timestamp.now(),
    createdBy: "creator-uid",
    shotIds: null,
    projectName: "Project",
    shots: [],
  }
}

let testEnv: RulesTestEnvironment | null = null

describeOrSkip("firestore.rules — captureOneShares", () => {
  beforeAll(async () => {
    if (!EMULATOR_HOST) return
    const [host, portStr] = EMULATOR_HOST.split(":")
    const port = Number(portStr || "8080")
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { host, port, rules: readFileSync(RULES_PATH, "utf8") },
    })

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()
      // Projects gate the project-scoped create rule (producerCanAccessProject).
      await setDoc(doc(db, "clients", CLIENT_A, "projects", PROJ_TEAM), { visibility: "team" })
      await setDoc(doc(db, "clients", CLIENT_A, "projects", PROJ_PRIVATE), { visibility: "private" })

      await setDoc(doc(db, "captureOneShares", SHARE_OK), makeShare())
      await setDoc(doc(db, "captureOneShares", SHARE_DISABLED), makeShare({ enabled: false }))
      await setDoc(doc(db, "captureOneShares", SHARE_EXPIRED), makeShare({ expiresAt: inPast(1) }))
      await setDoc(doc(db, "captureOneShares", SHARE_DELETABLE), makeShare())
      // A share with the expiresAt field OMITTED entirely (the production writer always
      // writes expiresAt:null, and the anon rule must not throw on a missing field).
      await setDoc(doc(db, "captureOneShares", SHARE_NO_EXPIRY), {
        clientId: CLIENT_A,
        projectId: PROJ_TEAM,
        title: "No expiry",
        enabled: true,
        createdAt: Timestamp.now(),
        createdBy: "creator-uid",
        shotIds: null,
        projectName: "Project",
        shots: [],
      })
    })
  })

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup()
  })

  function anon() {
    return testEnv!.unauthenticatedContext().firestore()
  }
  function authed(uid: string, clientId: string, role: string) {
    return testEnv!.authenticatedContext(uid, { clientId, role }).firestore()
  }

  it("[1] anon GET succeeds on an enabled, non-expired share", async () => {
    await assertSucceeds(getDoc(doc(anon(), "captureOneShares", SHARE_OK)))
  })

  it("[2] anon GET fails on a disabled share", async () => {
    await assertFails(getDoc(doc(anon(), "captureOneShares", SHARE_DISABLED)))
  })

  it("[3] anon GET fails on an expired share", async () => {
    await assertFails(getDoc(doc(anon(), "captureOneShares", SHARE_EXPIRED)))
  })

  it("[3b] anon GET succeeds when the expiresAt field is omitted entirely (existence-guard arm)", async () => {
    await assertSucceeds(getDoc(doc(anon(), "captureOneShares", SHARE_NO_EXPIRY)))
  })

  it("[4] anon LIST on captureOneShares fails", async () => {
    await assertFails(getDocs(collection(anon(), "captureOneShares")))
  })

  it("[5] authed producer GET succeeds when clientId matches", async () => {
    await assertSucceeds(getDoc(doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", SHARE_OK)))
  })

  it("[6] foreign-tenant authed producer cannot read a DISABLED share (no anon fallback; the management arm requires clientId match — an ENABLED share is anon-public by design)", async () => {
    await assertFails(getDoc(doc(authed("prod-b", CLIENT_B, "producer"), "captureOneShares", SHARE_DISABLED)))
  })

  it("[7] authed non-privileged role GET fails on a disabled share", async () => {
    await assertFails(getDoc(doc(authed("crew-a", CLIENT_A, "crew"), "captureOneShares", SHARE_DISABLED)))
  })

  it("[8] authed producer CREATE succeeds for own clientId on a team-visible project", async () => {
    await assertSucceeds(
      setDoc(doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", "share-new-ok"), makeShare()),
    )
  })

  it("[8b] authed producer CREATE fails for a private project they have no access to", async () => {
    await assertFails(
      setDoc(
        doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", "share-new-private"),
        makeShare({ projectId: PROJ_PRIVATE }),
      ),
    )
  })

  it("[9] authed producer CREATE fails when spoofing another clientId", async () => {
    await assertFails(
      setDoc(
        doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", "share-new-spoof"),
        makeShare({ clientId: CLIENT_B }),
      ),
    )
  })

  it("[10] CREATE fails when enabled is not a bool", async () => {
    await assertFails(
      setDoc(doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", "share-new-bad"), {
        ...makeShare(),
        enabled: "yes",
      }),
    )
  })

  it("[11] anon CREATE fails", async () => {
    await assertFails(setDoc(doc(anon(), "captureOneShares", "share-new-anon"), makeShare()))
  })

  it("[12] authed non-privileged role CREATE fails", async () => {
    await assertFails(
      setDoc(doc(authed("crew-a", CLIENT_A, "crew"), "captureOneShares", "share-new-crew"), makeShare()),
    )
  })

  it("[13] authed producer UPDATE succeeds for own clientId (refresh-on-save path)", async () => {
    await assertSucceeds(
      updateDoc(doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", SHARE_OK), {
        projectName: "Updated",
      }),
    )
  })

  it("[14] authed producer UPDATE fails for a different clientId", async () => {
    await assertFails(
      updateDoc(doc(authed("prod-b", CLIENT_B, "producer"), "captureOneShares", SHARE_OK), {
        projectName: "Hijack",
      }),
    )
  })

  it("[15] authed producer DELETE succeeds for own clientId", async () => {
    await assertSucceeds(deleteDoc(doc(authed("prod-a", CLIENT_A, "producer"), "captureOneShares", SHARE_DELETABLE)))
  })
})

// Visible skip notice so developers know why zero rules tests ran locally.
if (skipSuite) {
  describe("firestore.rules — captureOneShares (skipped)", () => {
    it("skipped: set FIRESTORE_EMULATOR_HOST to run rules unit tests", () => {
      expect(skipSuite).toBe(true)
    })
  })
}
