import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  schedulesPath,
  schedulePath,
  scheduleEntriesPath,
  scheduleDayDetailsPath,
  scheduleTalentCallsPath,
  scheduleCrewCallsPath,
  callSheetConfigPath,
} from "@/shared/lib/paths"
import type { ScheduleTrack, ScheduleSettings } from "@/shared/types"

function ref(segments: string[]) {
  return doc(db, segments[0]!, ...segments.slice(1))
}

function collRef(segments: string[]) {
  return collection(db, segments[0]!, ...segments.slice(1))
}

// --- Schedule CRUD ---

export async function createSchedule(
  clientId: string,
  projectId: string,
  fields: { readonly name: string; readonly date: unknown },
): Promise<string> {
  const coll = collRef(schedulesPath(projectId, clientId))
  const docRef = doc(coll)

  const tracks: readonly ScheduleTrack[] = [{ id: "primary", name: "Primary", order: 0 }]
  const settings: ScheduleSettings = {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  }

  await setDoc(docRef, {
    projectId,
    name: fields.name,
    date: fields.date ?? null,
    tracks,
    settings,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function deleteSchedule(
  clientId: string,
  projectId: string,
  scheduleId: string,
): Promise<void> {
  await deleteDoc(ref(schedulePath(projectId, scheduleId, clientId)))
}

export async function updateScheduleFields(
  clientId: string,
  projectId: string,
  scheduleId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await updateDoc(ref(schedulePath(projectId, scheduleId, clientId)), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

// --- Schedule Entries ---

export async function addScheduleEntryShot(
  clientId: string,
  projectId: string,
  scheduleId: string,
  fields: {
    readonly shotId: string
    readonly title: string
    readonly order: number
    readonly startTime?: string | null
    readonly duration?: number
    readonly trackId?: string
  },
): Promise<string> {
  const coll = collRef(scheduleEntriesPath(projectId, scheduleId, clientId))
  const docRef = doc(coll)
  await setDoc(docRef, {
    type: "shot",
    shotId: fields.shotId,
    title: fields.title,
    order: fields.order,
    startTime: fields.startTime ?? null,
    duration: fields.duration ?? null,
    trackId: fields.trackId ?? "primary",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function addScheduleEntryCustom(
  clientId: string,
  projectId: string,
  scheduleId: string,
  fields: {
    readonly type: "setup" | "break" | "move" | "banner"
    readonly title: string
    readonly order: number
    readonly startTime?: string | null
    readonly duration?: number
    readonly trackId?: string
    readonly appliesToTrackIds?: readonly string[] | null
  },
): Promise<string> {
  const coll = collRef(scheduleEntriesPath(projectId, scheduleId, clientId))
  const docRef = doc(coll)
  await setDoc(docRef, {
    type: fields.type,
    title: fields.title,
    order: fields.order,
    startTime: fields.startTime ?? null,
    duration: fields.duration ?? null,
    trackId: fields.trackId ?? "primary",
    appliesToTrackIds: fields.appliesToTrackIds ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function updateScheduleEntryFields(
  clientId: string,
  projectId: string,
  scheduleId: string,
  entryId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const segments = [
    ...scheduleEntriesPath(projectId, scheduleId, clientId),
    entryId,
  ]
  await updateDoc(ref(segments), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function batchUpdateScheduleEntries(
  clientId: string,
  projectId: string,
  scheduleId: string,
  updates: readonly { readonly entryId: string; readonly patch: Record<string, unknown> }[],
): Promise<void> {
  if (updates.length === 0) return
  const batch = writeBatch(db)
  for (const update of updates) {
    const segments = [
      ...scheduleEntriesPath(projectId, scheduleId, clientId),
      update.entryId,
    ]
    batch.update(ref(segments), {
      ...update.patch,
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

export async function batchUpdateScheduleAndEntries(
  clientId: string,
  projectId: string,
  scheduleId: string,
  input: {
    readonly schedulePatch?: Record<string, unknown>
    readonly entryUpdates?: readonly { readonly entryId: string; readonly patch: Record<string, unknown> }[]
  },
): Promise<void> {
  const hasSchedulePatch = !!input.schedulePatch && Object.keys(input.schedulePatch).length > 0
  const entryUpdates = input.entryUpdates ?? []
  if (!hasSchedulePatch && entryUpdates.length === 0) return

  const batch = writeBatch(db)

  if (hasSchedulePatch) {
    const segments = schedulePath(projectId, scheduleId, clientId)
    batch.update(ref(segments), {
      ...input.schedulePatch,
      updatedAt: serverTimestamp(),
    })
  }

  for (const update of entryUpdates) {
    const segments = [
      ...scheduleEntriesPath(projectId, scheduleId, clientId),
      update.entryId,
    ]
    batch.update(ref(segments), {
      ...update.patch,
      updatedAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

export async function removeScheduleEntry(
  clientId: string,
  projectId: string,
  scheduleId: string,
  entryId: string,
): Promise<void> {
  const segments = [
    ...scheduleEntriesPath(projectId, scheduleId, clientId),
    entryId,
  ]
  await deleteDoc(ref(segments))
}

// --- Day Details ---

export async function updateDayDetails(
  clientId: string,
  projectId: string,
  scheduleId: string,
  dayDetailsId: string | null,
  patch: Record<string, unknown>,
): Promise<string> {
  const basePath = scheduleDayDetailsPath(projectId, scheduleId, clientId)

  if (dayDetailsId) {
    const segments = [...basePath, dayDetailsId]
    await updateDoc(ref(segments), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    return dayDetailsId
  }

  const coll = collRef(basePath)
  const docRef = doc(coll)
  await setDoc(docRef, {
    scheduleId,
    ...patch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

// --- Talent Calls ---

export async function upsertTalentCall(
  clientId: string,
  projectId: string,
  scheduleId: string,
  talentCallId: string | null,
  patch: Record<string, unknown>,
): Promise<string> {
  const basePath = scheduleTalentCallsPath(projectId, scheduleId, clientId)

  if (talentCallId) {
    const segments = [...basePath, talentCallId]
    await updateDoc(ref(segments), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    return talentCallId
  }

  const coll = collRef(basePath)
  const docRef = doc(coll)
  await setDoc(docRef, {
    ...patch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function removeTalentCall(
  clientId: string,
  projectId: string,
  scheduleId: string,
  talentCallId: string,
): Promise<void> {
  const segments = [
    ...scheduleTalentCallsPath(projectId, scheduleId, clientId),
    talentCallId,
  ]
  await deleteDoc(ref(segments))
}

// --- Crew Calls ---

export async function upsertCrewCall(
  clientId: string,
  projectId: string,
  scheduleId: string,
  crewCallId: string | null,
  patch: Record<string, unknown>,
): Promise<string> {
  const basePath = scheduleCrewCallsPath(projectId, scheduleId, clientId)

  if (crewCallId) {
    const segments = [...basePath, crewCallId]
    await updateDoc(ref(segments), {
      ...patch,
      updatedAt: serverTimestamp(),
    })
    return crewCallId
  }

  const coll = collRef(basePath)
  const docRef = doc(coll)
  await setDoc(docRef, {
    ...patch,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

export async function removeCrewCall(
  clientId: string,
  projectId: string,
  scheduleId: string,
  crewCallId: string,
): Promise<void> {
  const segments = [
    ...scheduleCrewCallsPath(projectId, scheduleId, clientId),
    crewCallId,
  ]
  await deleteDoc(ref(segments))
}

// --- Call Sheet Config (Slice 4: Output + Distribution) ---

export async function upsertCallSheetConfig(
  clientId: string,
  projectId: string,
  scheduleId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const segments = callSheetConfigPath(projectId, scheduleId, clientId)
  await setDoc(
    ref(segments),
    {
      projectId,
      scheduleId,
      ...patch,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  )
}
