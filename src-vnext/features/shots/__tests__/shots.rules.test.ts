// @vitest-environment node
/**
 * Firestore rules tests for /clients/{clientId}/shots and its adjacent write
 * surfaces (project members self-create, shotShares, shot versions, the
 * create-project-from-request transaction shape).
 *
 * History: commit 1 pinned TODAY'S permissive behavior (everything
 * assertSucceeds under the isAuthed-only /shots rule). This commit hardens
 * the rules and flips the pins in the SAME diff, so the assertSucceeds →
 * assertFails flips ARE the reviewable behavior change. Each flipped test
 * carries a comment naming the rule arm that now decides it.
 *
 * Write shapes mirror the real client writers byte-for-byte:
 *   - shot create: CreateShotDialog.tsx
 *   - shot update: updateShotWithVersion.ts
 *   - shot move: shotLifecycleActions.ts moveShotToProject
 *   - version create: shotVersioning.ts createShotVersionSnapshot
 *   - member self-create: adminWrites.ts addProjectMember
 *   - share create: ShotsShareDialog.tsx Firestore fallback
 *   - project-from-request batch: requestWrites.ts createProjectFromRequest
 *   - project + self-member batch: CreateProjectDialog.tsx handleCreate
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
  assertFails,
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
const MEMBER_CREW_UID = "member-crew-uid"
const MEMBER_VIEWER_UID = "member-viewer-uid"
const PRODUCER_UID = "producer-uid"
const OWNER_UID = "owner-uid"

// Seeded projects: one with an explicit visibility field, one without
// (a missing visibility field counts as team-visible), a move target, and
// a private project (creator-only) owned by someone else.
const PROJ_TEAM = "proj-team"
const PROJ_UNSET = "proj-unset"
const PROJ_TARGET = "proj-target"
const PROJ_PRIVATE = "proj-private"

const REQUEST_ID = "req-1"

// Matches the real client-side bulk write chunk (BATCH_CHUNK_SIZE) so the
// 250-update batch test proves the rule-eval get() budget at production size.
const BATCH_SIZE = 250

// Seeded shots, one per mutation test so tests stay order-independent.
const SHOT_VIEWER_UPDATE = "shot-viewer-update"
const SHOT_VIEWER_DELETE = "shot-viewer-delete"
const SHOT_CREW_UPDATE = "shot-crew-update"
const SHOT_CREW_DELETE = "shot-crew-delete"
const SHOT_MEMBER_CREW_UPDATE = "shot-member-crew-update"
const SHOT_MEMBER_CREW_DELETE = "shot-member-crew-delete"
const SHOT_MEMBER_VIEWER_UPDATE = "shot-member-viewer-update"
const SHOT_PRODUCER_UNSET_UPDATE = "shot-producer-unset-update"
const SHOT_PRODUCER_TEAM_DELETE = "shot-producer-team-delete"
const SHOT_PRIVATE_UPDATE = "shot-private-update"
const SHOT_PRIVATE_DELETE = "shot-private-delete"
const SHOT_EMPTY_PRODUCER_UPDATE = "shot-empty-producer-update"
const SHOT_EMPTY_PRODUCER_DELETE = "shot-empty-producer-delete"
const SHOT_EMPTY_CREW_UPDATE = "shot-empty-crew-update"
const SHOT_MOVE = "shot-move"
const SHOT_MOVE_CREW = "shot-move-crew"
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
    createdByName: "Test User",
    createdByAvatar: null,
    changeType: "update",
    changedFields: ["title"],
    createdAt: serverTimestamp(),
  }
}

/** shotShares doc — mirrors ShotsShareDialog.tsx Firestore fallback. */
function makeShareDoc(projectId: string) {
  return {
    clientId: CLIENT_ID,
    projectId,
    shotIds: null,
    enabled: true,
    title: "All shots",
    expiresAt: null,
    createdAt: serverTimestamp(),
    createdBy: PRODUCER_UID,
    projectName: "Some Project",
    resolvedShots: [],
    columnConfig: ["title", "talent", "products"],
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

function memberCrewDb() {
  return testEnv!
    .authenticatedContext(MEMBER_CREW_UID, { role: "crew", clientId: CLIENT_ID })
    .firestore()
}

function memberViewerDb() {
  return testEnv!
    .authenticatedContext(MEMBER_VIEWER_UID, { role: "viewer", clientId: CLIENT_ID })
    .firestore()
}

function producerDb() {
  return testEnv!
    .authenticatedContext(PRODUCER_UID, { role: "producer", clientId: CLIENT_ID })
    .firestore()
}

describeOrSkip("firestore.rules — shots write surfaces (hardened, 5b)", () => {
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

      // Private project owned by someone else — producerCanAccessProject must
      // NOT grant the global producer a lane here.
      await setDoc(doc(db, "clients", CLIENT_ID, "projects", PROJ_PRIVATE), {
        name: "Private Project",
        clientId: CLIENT_ID,
        status: "active",
        visibility: "private",
        shootDates: [],
        createdBy: OWNER_UID,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      })

      // Members docs (app shape: role / addedAt / addedBy) — the
      // hasProjectRole ALLOW arm fixtures.
      await setDoc(
        doc(db, "clients", CLIENT_ID, "projects", PROJ_TEAM, "members", MEMBER_CREW_UID),
        { role: "crew", addedAt: Timestamp.now(), addedBy: OWNER_UID },
      )
      await setDoc(
        doc(db, "clients", CLIENT_ID, "projects", PROJ_TEAM, "members", MEMBER_VIEWER_UID),
        { role: "viewer", addedAt: Timestamp.now(), addedBy: OWNER_UID },
      )

      for (const shotId of [
        SHOT_VIEWER_UPDATE,
        SHOT_VIEWER_DELETE,
        SHOT_CREW_UPDATE,
        SHOT_CREW_DELETE,
        SHOT_MEMBER_CREW_UPDATE,
        SHOT_MEMBER_CREW_DELETE,
        SHOT_MEMBER_VIEWER_UPDATE,
        SHOT_PRODUCER_TEAM_DELETE,
        SHOT_MOVE,
        SHOT_MOVE_CREW,
        SHOT_VERSIONS,
      ]) {
        await setDoc(
          doc(db, "clients", CLIENT_ID, "shots", shotId),
          makeSeedShot(PROJ_TEAM),
        )
      }

      await setDoc(
        doc(db, "clients", CLIENT_ID, "shots", SHOT_PRODUCER_UNSET_UPDATE),
        makeSeedShot(PROJ_UNSET),
      )

      for (const shotId of [SHOT_PRIVATE_UPDATE, SHOT_PRIVATE_DELETE]) {
        await setDoc(
          doc(db, "clients", CLIENT_ID, "shots", shotId),
          makeSeedShot(PROJ_PRIVATE),
        )
      }

      // Legacy shots: empty-string projectId (mapShot.ts '' fallback shape).
      for (const shotId of [
        SHOT_EMPTY_PRODUCER_UPDATE,
        SHOT_EMPTY_PRODUCER_DELETE,
        SHOT_EMPTY_CREW_UPDATE,
      ]) {
        await setDoc(
          doc(db, "clients", CLIENT_ID, "shots", shotId),
          makeSeedShot(""),
        )
      }

      // 250 shots in one project for the batch get()-budget test.
      const seedBatch = writeBatch(db)
      for (let i = 0; i < BATCH_SIZE; i++) {
        seedBatch.set(
          doc(db, "clients", CLIENT_ID, "shots", `batch-shot-${i}`),
          makeSeedShot(PROJ_TEAM),
        )
      }
      await seedBatch.commit()

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

  // --- (a) viewer-claim shot writes — DENIED by the hardened /shots rule ---
  // (flipped pins: viewer passes neither hasGlobalRole(['producer']) nor the
  // shotProjectRole arm — no members doc, viewer not in ['producer','crew'])

  it("[a1] viewer-claim CANNOT create a shot", async () => {
    const db = viewerDb()
    await assertFails(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-viewer-create"),
        makeShotCreate(PROJ_TEAM, VIEWER_UID),
      ),
    )
  })

  it("[a2] viewer-claim CANNOT update a shot", async () => {
    const db = viewerDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_VIEWER_UPDATE), {
        title: "Viewer edited title",
        updatedAt: serverTimestamp(),
        updatedBy: VIEWER_UID,
      }),
    )
  })

  it("[a3] viewer-claim CANNOT delete a shot", async () => {
    const db = viewerDb()
    await assertFails(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_VIEWER_DELETE)),
    )
  })

  // --- (b) crew-claim NON-member (no members doc anywhere) shot writes ---
  // (flipped pins: the hasProjectRole arm requires a members doc; a global
  // crew claim alone no longer writes shots — guarantee #1 for 5e)

  it("[b1] crew-claim non-member CANNOT create a shot", async () => {
    const db = crewDb()
    await assertFails(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-crew-create"),
        makeShotCreate(PROJ_UNSET, CREW_UID),
      ),
    )
  })

  it("[b2] crew-claim non-member CANNOT update a shot", async () => {
    const db = crewDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_CREW_UPDATE), {
        title: "Crew edited title",
        updatedAt: serverTimestamp(),
        updatedBy: CREW_UID,
      }),
    )
  })

  it("[b3] crew-claim non-member CANNOT delete a shot", async () => {
    const db = crewDb()
    await assertFails(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_CREW_DELETE)),
    )
  })

  // --- member-crew (members doc role 'crew') — the hasProjectRole ALLOW arm ---

  it("member-crew CAN create a shot on their project", async () => {
    const db = memberCrewDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-member-crew-create"),
        makeShotCreate(PROJ_TEAM, MEMBER_CREW_UID),
      ),
    )
  })

  it("member-crew CAN update a shot on their project", async () => {
    const db = memberCrewDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_MEMBER_CREW_UPDATE), {
        title: "Member crew edited title",
        updatedAt: serverTimestamp(),
        updatedBy: MEMBER_CREW_UID,
      }),
    )
  })

  it("member-crew CAN delete a shot on their project", async () => {
    const db = memberCrewDb()
    await assertSucceeds(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_MEMBER_CREW_DELETE)),
    )
  })

  // --- member-VIEWER (members doc role 'viewer') — still no write arm ---

  it("member-viewer CANNOT create a shot on their project", async () => {
    const db = memberViewerDb()
    await assertFails(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-member-viewer-create"),
        makeShotCreate(PROJ_TEAM, MEMBER_VIEWER_UID),
      ),
    )
  })

  it("member-viewer CANNOT update a shot on their project", async () => {
    const db = memberViewerDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_MEMBER_VIEWER_UPDATE), {
        title: "Member viewer edited title",
        updatedAt: serverTimestamp(),
        updatedBy: MEMBER_VIEWER_UID,
      }),
    )
  })

  // --- non-member global producer — producerCanAccessProject lane ---

  it("non-member producer CAN create a shot on a team-visible project", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-producer-team-create"),
        makeShotCreate(PROJ_TEAM, PRODUCER_UID),
      ),
    )
  })

  it("non-member producer CAN create a shot on a visibility-absent project", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-producer-unset-create"),
        makeShotCreate(PROJ_UNSET, PRODUCER_UID),
      ),
    )
  })

  it("non-member producer CAN update a shot on a visibility-absent project", async () => {
    const db = producerDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_PRODUCER_UNSET_UPDATE), {
        title: "Producer edited title",
        updatedAt: serverTimestamp(),
        updatedBy: PRODUCER_UID,
      }),
    )
  })

  it("non-member producer CAN delete a shot on a team-visible project", async () => {
    const db = producerDb()
    await assertSucceeds(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_PRODUCER_TEAM_DELETE)),
    )
  })

  it("non-member producer CANNOT update a shot on a private project", async () => {
    const db = producerDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_PRIVATE_UPDATE), {
        title: "Producer edited title",
        updatedAt: serverTimestamp(),
        updatedBy: PRODUCER_UID,
      }),
    )
  })

  it("non-member producer CANNOT delete a shot on a private project", async () => {
    const db = producerDb()
    await assertFails(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_PRIVATE_DELETE)),
    )
  })

  // Accepted-by-spec asymmetry: the unconditional hasGlobalRole(['producer'])
  // CREATE lane (required by the createProjectFromRequest one-transaction flow,
  // where rules see pre-transaction state) intentionally bypasses target-project
  // visibility — a global producer can CREATE into a private project even
  // though update/delete there are denied above.
  it("non-member producer CAN create a shot on a private project (create-lane asymmetry, accepted-by-spec)", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(
        doc(db, "clients", CLIENT_ID, "shots", "shot-producer-private-create"),
        makeShotCreate(PROJ_PRIVATE, PRODUCER_UID),
      ),
    )
  })

  // --- empty-string projectId (legacy shots) — admin / global producer only ---

  it("producer CAN update an empty-projectId shot (legacy arm)", async () => {
    const db = producerDb()
    await assertSucceeds(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_EMPTY_PRODUCER_UPDATE), {
        title: "Producer edited legacy shot",
        updatedAt: serverTimestamp(),
        updatedBy: PRODUCER_UID,
      }),
    )
  })

  it("producer CAN delete an empty-projectId shot (legacy arm)", async () => {
    const db = producerDb()
    await assertSucceeds(
      deleteDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_EMPTY_PRODUCER_DELETE)),
    )
  })

  it("member-crew CANNOT update an empty-projectId shot (legacy arm is producer-only)", async () => {
    const db = memberCrewDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_EMPTY_CREW_UPDATE), {
        title: "Crew edited legacy shot",
        updatedAt: serverTimestamp(),
        updatedBy: MEMBER_CREW_UID,
      }),
    )
  })

  // --- 250-doc single-project batch (real BATCH_CHUNK_SIZE) ---
  // Proves the rule-eval document-access budget: every update resolves the
  // same project doc + the same members doc, so the whole batch touches 2
  // unique documents — well under the 20-access limit for batched writes.

  it("member-crew CAN commit a 250-update single-project batch", async () => {
    const db = memberCrewDb()
    const batch = writeBatch(db)
    for (let i = 0; i < BATCH_SIZE; i++) {
      batch.update(doc(db, "clients", CLIENT_ID, "shots", `batch-shot-${i}`), {
        title: `Batch edited ${i}`,
        updatedAt: serverTimestamp(),
        updatedBy: MEMBER_CREW_UID,
      })
    }
    await assertSucceeds(batch.commit())
  })

  // --- (c) members self-create carve-out ---
  // (flipped pin: the carve-out now requires getAfter(project).createdBy ==
  // request.auth.uid — self-minting membership on someone else's existing
  // project is the self-elevation hole 5b closes)

  it("[c] producer-claim CANNOT self-create a producer members doc on an existing project they did not create", async () => {
    const db = producerDb()
    await assertFails(
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

  // Carve-out positive path: project create + self-member in ONE batch
  // (CreateProjectDialog.tsx handleCreate shape — createdBy set to self, so
  // getAfter resolves the pending project write).
  it("producer-claim CAN self-add as member when creating the project in the same batch", async () => {
    const db = producerDb()
    const projectRef = doc(collection(db, "clients", CLIENT_ID, "projects"))
    const memberRef = doc(
      db,
      "clients",
      CLIENT_ID,
      "projects",
      projectRef.id,
      "members",
      PRODUCER_UID,
    )

    const batch = writeBatch(db)
    batch.set(projectRef, {
      name: "Dialog Project",
      clientId: CLIENT_ID,
      status: "active",
      visibility: "team",
      shootDates: [],
      createdBy: PRODUCER_UID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    batch.set(memberRef, {
      role: "producer",
      addedAt: serverTimestamp(),
      addedBy: PRODUCER_UID,
    })

    await assertSucceeds(batch.commit())
  })

  // --- (d) createProjectFromRequest transaction shape ---
  // MUST stay green: the shot create rides the hasGlobalRole(['producer'])
  // CREATE lane (rules see pre-transaction state), and the member self-create
  // carve-out resolves the same-transaction project write via getAfter.
  // Project payload now includes createdBy — mirrors requestWrites.ts, which
  // gained the field in this PR so the tightened carve-out covers this flow.

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
      createdBy: PRODUCER_UID,
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
  // Stays green: the project-move update arm (global producer + project role
  // on the TARGET projectId; PROJ_TARGET is team-visible).

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

  it("member-crew CANNOT change a shot's projectId (projectId immutability pin; move arm is admin/global-producer only)", async () => {
    const db = memberCrewDb()
    await assertFails(
      updateDoc(doc(db, "clients", CLIENT_ID, "shots", SHOT_MOVE_CREW), {
        projectId: PROJ_TARGET,
        laneId: null,
        updatedAt: serverTimestamp(),
        updatedBy: MEMBER_CREW_UID,
      }),
    )
  })

  // --- (f) shotShares (top-level collection) — project-scoped create ---

  it("[f1] producer-claim CAN create a share for an existing team-visible project", async () => {
    const db = producerDb()
    await assertSucceeds(
      setDoc(
        doc(db, "shotShares", "share-token-team-1"),
        makeShareDoc(PROJ_TEAM),
      ),
    )
  })

  it("[f2] producer-claim CANNOT create a share whose projectId points at a nonexistent project", async () => {
    // Flipped pin: producerCanAccessProject/hasProjectRole find no project or
    // members doc — the arbitrary-projectId share mint is closed.
    const db = producerDb()
    await assertFails(
      setDoc(
        doc(db, "shotShares", "share-token-nonexistent-1"),
        makeShareDoc("some-project-the-producer-never-touched"),
      ),
    )
  })

  it("[f3] producer-claim CANNOT create a share for a private project they are not a member of", async () => {
    const db = producerDb()
    await assertFails(
      setDoc(
        doc(db, "shotShares", "share-token-private-1"),
        makeShareDoc(PROJ_PRIVATE),
      ),
    )
  })

  // --- (g) versions subcollection ---
  // (flipped pin: versions CREATE now carries the same shotProjectRole arm as
  // the parent shot — a denied shot-writer cannot snapshot shot data)

  it("[g] viewer-claim CANNOT create a versions doc under a shot", async () => {
    const db = viewerDb()
    await assertFails(
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

  it("member-crew CAN create a versions doc under a shot on their project", async () => {
    const db = memberCrewDb()
    await assertSucceeds(
      setDoc(
        doc(
          db,
          "clients",
          CLIENT_ID,
          "shots",
          SHOT_VERSIONS,
          "versions",
          "version-2",
        ),
        makeVersionDoc(MEMBER_CREW_UID),
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
