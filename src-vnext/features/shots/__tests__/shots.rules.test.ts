// @vitest-environment node
/**
 * Firestore rules characterization tests for /clients/{clientId}/shots and
 * its adjacent write surfaces (project members self-create, shotShares,
 * shot versions, the create-project-from-request transaction shape).
 *
 * These pins capture TODAY'S permissive behavior — every test asserts
 * SUCCESS against the current rules. When the shots write rules harden,
 * the pins flip to assertFails in the same commit so the diff IS the
 * reviewable behavior change.
 *
 * Write shapes mirror the real client writers byte-for-byte:
 *   - shot create: CreateShotDialog.tsx
 *   - shot update: updateShotWithVersion.ts
 *   - shot move: shotLifecycleActions.ts moveShotToProject
 *   - version create: shotVersioning.ts createShotVersionSnapshot
 *   - member self-create: adminWrites.ts addProjectMember
 *   - share create: ShotsShareDialog.tsx Firestore fallback
 *   - project-from-request batch: requestWrites.ts createProjectFromRequest
 *
 * Requires the Firestore emulator. When `FIRESTORE_EMULATOR_HOST` is not
 * set, the suite is skipped so `CI=1 npm test -- --run` stays green on
 * developer machines without a running emulator. CI (ui-checks.yml) starts
 * the emulator on port 8080 and sets the host, so these tests run there.
 */

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import {
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing"
import {
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"

const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST
const skipSuite = !EMULATOR_HOST
const describeOrSkip = skipSuite ? describe.skip : describe

const PROJECT_ID = "demo-shots-rules"
const RULES_PATH = resolve(__dirname, "../../../../firestore.rules")

const CLIENT_ID = "unbound-merino"

const VIEWER_UID = "viewer-uid"
const CREW_UID = "crew-uid"
const PRODUCER_UID = "producer-uid"
const OWNER_UID = "owner-uid"

// Seeded projects: one with an explicit visibility field, one without
// (a missing visibility field counts as team-visible), plus a move target.
const PROJ_TEAM = "proj-team"
const PROJ_UNSET = "proj-unset"
const PROJ_TARGET = "proj-target"

const REQUEST_ID = "req-1"

// Seeded shots, one per mutation pin so tests stay order-independent.
const SHOT_VIEWER_UPDATE = "shot-viewer-update"
const SHOT_VIEWER_DELETE = "shot-viewer-delete"
const SHOT_CREW_UPDATE = "shot-crew-update"
const SHOT_CREW_DELETE = "shot-crew-delete"
const SHOT_MOVE = "shot-move"
const SHOT_VERSIONS = "shot-versions"

/** Shot create payload — mirrors CreateShotDialog.tsx handleCreate. */
function makeShotCreate(projectId: string, createdBy: string) {
  return {
    title: "Hero look",
    description: null,
    projectId,
    clientId: CLIENT_ID,
    status: "todo",
    talent: [],
    products: [],
    sortOrder: Date.now(),
    shotNumber: 1,
    date: null,
    deleted: false,
    notes: null,
    referenceLinks: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy,
  }
}

/** Seed-side shot doc (rules-disabled writes use concrete timestamps). */
function makeSeedShot(projectId: string) {
  return {
    title: "Seeded shot",
    description: null,
    projectId,
    clientId: CLIENT_ID,
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 1,
    shotNumber: 1,
    date: null,
    deleted: false,
    notes: null,
    referenceLinks: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    createdBy: OWNER_UID,
  }
}

/** Version doc — mirrors shotVersioning.ts createShotVersionSnapshot. */
function makeVersionDoc(createdBy: string) {
  return {
    snapshot: {
      title: "Seeded shot",
      description: null,
      status: "todo",
      shotNumber: 1,
      date: null,
      talent: [],
      talentIds: [],
      products: [],
      locationId: null,
      locationName: null,
      laneId: null,
      notes: null,
      notesAddendum: null,
      heroImage: null,
      looks: [],
      activeLookId: null,
      tags: [],
      referenceLinks: [],
    },
    createdBy,
    createdByName: "Viewer User",
    createdByAvatar: null,
    changeType: "update",
    changedFields: ["title"],
    createdAt: serverTimestamp(),
  }
}

let testEnv: RulesTestEnvironment | null = null

function viewerDb() {
  return testEnv!
    .authenticatedContext(VIEWER_UID, { role: "viewer", clientId: CLIENT_ID })
    .firestore()
}

function crewDb() {
  return testEnv!
    .authenticatedContext(CREW_UID, { role: "crew", clientId: CLIENT_ID })
    .firestore()
}

function producerDb() {
  return testEnv!
    .authenticatedContext(PRODUCER_UID, { role: "producer", clientId: CLIENT_ID })
    .firestore()
}

describeOrSkip("firestore.rules — shots write surfaces (characterization pins)", () => {
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

    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore()

      await setDoc(doc(db, "clients", CLIENT_ID), { name: "Unbound Merino" })

      // Project with an explicit visibility field (CreateProjectDialog shape).
      await setDoc(doc(db, "clients", CLIENT_ID, "projects", PROJ_TEAM), {
        name: "Team Project",
        clientId: CLIENT_ID,
        status: "active",
        visibility: "team",
        shootDates: [],
        createdBy: OWNER_UID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      // Project WITHOUT a visibility field (the common live state).
      await setDoc(doc(db, "clients", CLIENT_ID, "projects", PROJ_UNSET), {
        name: "Unset Visibility Project",
        clientId: CLIENT_ID,
        status: "active",
        shootDates: [],
        createdBy: OWNER_UID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      await setDoc(doc(db, "clients", CLIENT_ID, "projects", PROJ_TARGET), {
        name: "Move Target Project",
        clientId: CLIENT_ID,
        status: "active",
        shootDates: [],
        createdBy: OWNER_UID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      for (const shotId of [
        SHOT_VIEWER_UPDATE,
        SHOT_VIEWER_DELETE,
        SHOT_CREW_UPDATE,
        SHOT_CREW_DELETE,
        SHOT_MOVE,
        SHOT_VERSIONS,
      ]) {
        await setDoc(
          doc(db, "clients", CLIENT_ID, "shots", shotId),
          makeSeedShot(PROJ_TEAM),
        )
      }

      // Submitted shot request (submitShotRequest shape) for the
      // create-project-from-request transaction pin.
      await setDoc(doc(db, "clients", CLIENT_ID, "shotRequests", REQUEST_ID), {
        clientId: CLIENT_ID,
        status: "submitted",
        priority: "normal",
        title: "Requested shot",
        description: null,
        referenceUrls: null,
        references: null,
        deadline: null,
        notes: null,
        submittedBy: OWNER_UID,
        submittedByName: null,
        relatedFamilyIds: null,
        notifyUserIds: null,
        submittedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })
    })
  })

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup()
    }
  })

  // --- (a) viewer-claim shot writes pass under the isAuthed-only rule ---

  it("[a1] viewer-claim CAN create a shot", async () => {
    const db = viewerDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-viewer-create"),
        makeShotCreate(PROJ_TEAM, VIEWER_UID),
      ),
    )
  })

  it("[a2] viewer-claim CAN update a shot", async () => {
    const db = viewerDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_VIEWER_UPDATE), {
        title: "Viewer edited title",
        updatedAt: serverTimestamp(),
        updatedBy: VIEWER_UID,
      }),
    )
  })

  it("[a3] viewer-claim CAN delete a shot", async () => {
    const db = viewerDb()
    await assertSucceeds(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_VIEWER_DELETE)),
    )
  })

  // --- (b) crew-claim NON-member (no members doc anywhere) shot writes ---

  it("[b1] crew-claim non-member CAN create a shot", async () => {
    const db = crewDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-crew-create"),
        makeShotCreate(PROJ_UNSET, CREW_UID),
      ),
    )
  })

  it("[b2] crew-claim non-member CAN update a shot", async () => {
    const db = crewDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_CREW_UPDATE), {
        title: "Crew edited title",
        updatedAt: serverTimestamp(),
        updatedBy: CREW_UID,
      }),
    )
  })

  it("[b3] crew-claim non-member CAN delete a shot", async () => {
    const db = crewDb()
    await assertSucceeds(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_CREW_DELETE)),
    )
  })

  // --- (c) members self-create carve-out ---

  it("[c] producer-claim CAN self-create a producer members doc on an existing project they did not create", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(
        doc(
          db,
          "clients",
          CLIENT_ID,
          "projects",
          PROJ_TEAM,
          "members",
          PRODUCER_UID,
        ),
        {
          role: "producer",
          addedAt: serverTimestamp(),
          addedBy: PRODUCER_UID,
        },
      ),
    )
  })

  // --- (d) createProjectFromRequest transaction shape ---

  it("[d] producer-claim createProjectFromRequest batch (project + member + shot + request update) SUCCEEDS", async () => {
    const db = producerDb()
    const projectRef = doc(collection(db, "clients", CLIENT_ID, "projects"))
    const shotRef = doc(collection(db, "clients", CLIENT_ID, "shots"))
    const memberRef = doc(
      db,
      "clients",
      CLIENT_ID,
      "projects",
      projectRef.id,
      "members",
      PRODUCER_UID,
    )
    const requestRef = doc(db, "clients", CLIENT_ID, "shotRequests", REQUEST_ID)

    const batch = writeBatch(db)
    batch.set(projectRef, {
      name: "Absorbed Project",
      clientId: CLIENT_ID,
      status: "active",
      shootDates: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.set(memberRef, {
      role: "producer",
      addedAt: serverTimestamp(),
      addedBy: PRODUCER_UID,
    })
    batch.set(shotRef, {
      title: "Requested shot",
      description: "",
      projectId: projectRef.id,
      clientId: CLIENT_ID,
      status: "todo",
      deleted: false,
      date: null,
      talent: [],
      products: [],
      sortOrder: Date.now(),
      sourceRequestId: REQUEST_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: PRODUCER_UID,
    })
    batch.update(requestRef, {
      status: "absorbed",
      triagedBy: PRODUCER_UID,
      triagedAt: serverTimestamp(),
      absorbedIntoProjectId: projectRef.id,
      absorbedAsShotId: shotRef.id,
      updatedAt: serverTimestamp(),
    })

    await assertSucceeds(batch.commit())
  })

  // --- (e) project-move ---

  it("[e] producer-claim CAN update a shot's projectId to a different project", async () => {
    const db = producerDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_MOVE), {
        projectId: PROJ_TARGET,
        laneId: null,
        updatedAt: serverTimestamp(),
        updatedBy: PRODUCER_UID,
      }),
    )
  })

  // --- (f) shotShares (top-level collection) ---

  it("[f] producer-claim CAN create an enabled shotShares doc with an arbitrary projectId string", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(doc(db, "shotShares", "share-token-characterization-1"), {
        clientId: CLIENT_ID,
        projectId: "some-project-the-producer-never-touched",
        shotIds: null,
        enabled: true,
        title: "All shots",
        expiresAt: null,
        createdAt: serverTimestamp(),
        createdBy: PRODUCER_UID,
        projectName: "Some Project",
        resolvedShots: [],
        columnConfig: ["title", "talent", "products"],
      }),
    )
  })

  // --- (g) versions subcollection ---

  it("[g] viewer-claim CAN create a versions doc under a shot", async () => {
    const db = viewerDb()
    await assertSucceeds(
      setDoc(
        doc(
          db,
          "clients",
          CLIENT_ID,
          "shots",
          SHOT_VERSIONS,
          "versions",
          "version-1",
        ),
        makeVersionDoc(VIEWER_UID),
      ),
    )
  })
})

// Ensure the skip notice is visible in test output so developers know why
// zero rules tests ran locally.
if (skipSuite) {
  describe("firestore.rules — shots write surfaces (skipped)", () => {
    it("skipped: set FIRESTORE_EMULATOR_HOST to run rules unit tests", () => {
      expect(skipSuite).toBe(true)
    })
  })
}
