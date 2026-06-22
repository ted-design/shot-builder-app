// @vitest-environment node
/**
 * Firestore rules tests for exportReports — the collection that now also holds
 * saved shot-report docs (reportType:'shot-report' + config). This collection
 * had ZERO rules coverage; these lock in the guarantees R2's writers rely on.
 *
 * Tested on a PRIVATE project so the permissive project wildcard catch-all is
 * off (producerCanAccessProject requires visibility=='team'), leaving the
 * explicit exportReports block — including its createdBy invariant — governing.
 *
 * Requires the Firestore emulator; self-skips when FIRESTORE_EMULATOR_HOST is unset.
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
import { doc, setDoc, updateDoc, Timestamp } from "firebase/firestore"

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const skipSuite = !EMULATOR_HOST
const describeOrSkip = skipSuite ? describe.skip : describe

const PROJECT_ID = "demo-exportreports-rules"
const RULES_PATH = resolve(__dirname, "../../../../firestore.rules")

const CLIENT_A = "client-a"
const CLIENT_B = "client-b"
const PROJ = "proj-private" // private => wildcard off, explicit block governs
const REPORT_OWNED = "report-owned" // seeded with createdBy == prod-a

function shotReportDoc(createdBy: string) {
  return {
    name: "Deck",
    reportType: "shot-report",
    schemaVersion: 2,
    config: { groupBy: "gender", excludedShotIds: [] },
    pages: [],
    settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
    customVariables: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy,
    updatedBy: createdBy,
  }
}

let testEnv: RulesTestEnvironment | null = null

describeOrSkip("firestore.rules — exportReports (shot-report docs)", () => {
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
      await setDoc(doc(db, "clients", CLIENT_A, "projects", PROJ), { visibility: "private" })
      await setDoc(
        doc(db, "clients", CLIENT_A, "projects", PROJ, "exportReports", REPORT_OWNED),
        shotReportDoc("prod-a"),
      )
    })
  })

  afterAll(async () => {
    if (testEnv) await testEnv.cleanup()
  })

  function authed(uid: string, clientId: string, role: string) {
    return testEnv!.authenticatedContext(uid, { clientId, role }).firestore()
  }
  function anon() {
    return testEnv!.unauthenticatedContext().firestore()
  }
  const reportRef = (db: ReturnType<typeof anon>, id: string) =>
    doc(db, "clients", CLIENT_A, "projects", PROJ, "exportReports", id)

  it("[1] producer CREATE a shot-report doc succeeds when createdBy == own uid", async () => {
    const db = authed("prod-a", CLIENT_A, "producer")
    await assertSucceeds(setDoc(reportRef(db, "report-new"), shotReportDoc("prod-a")))
  })

  it("[2] producer CREATE fails when createdBy != own uid (createdBy invariant holds)", async () => {
    const db = authed("prod-a", CLIENT_A, "producer")
    await assertFails(setDoc(reportRef(db, "report-spoof"), shotReportDoc("someone-else")))
  })

  it("[3] producer UPDATE of config succeeds, preserving createdBy (saveReportConfig path)", async () => {
    const db = authed("prod-a", CLIENT_A, "producer")
    await assertSucceeds(
      updateDoc(reportRef(db, REPORT_OWNED), {
        config: { groupBy: "none", excludedShotIds: ["s1"] },
        updatedBy: "prod-a",
      }),
    )
  })

  it("[4] foreign-tenant producer CREATE in another client's path fails", async () => {
    const db = authed("prod-b", CLIENT_B, "producer")
    await assertFails(setDoc(reportRef(db, "report-foreign"), shotReportDoc("prod-b")))
  })

  it("[5] viewer CREATE fails (not a producer/admin; wildcard off on private project)", async () => {
    const db = authed("viewer-a", CLIENT_A, "viewer")
    await assertFails(setDoc(reportRef(db, "report-viewer"), shotReportDoc("viewer-a")))
  })

  it("[6] anon CREATE fails", async () => {
    await assertFails(setDoc(reportRef(anon(), "report-anon"), shotReportDoc("nobody")))
  })
})

// Visible skip notice so developers know why zero rules tests ran locally.
if (skipSuite) {
  describe("firestore.rules — exportReports (skipped)", () => {
    it("skipped: set FIRESTORE_EMULATOR_HOST to run rules unit tests", () => {
      expect(skipSuite).toBe(true)
    })
  })
}
