import { describe, expect, it, vi, beforeEach } from "vitest"

const setDocMock = vi.fn()
const docMock = vi.fn((...segments: unknown[]) => ({ __ref: segments.slice(1) }))
const serverTimestampMock = vi.fn(() => "MOCK_SERVER_TIMESTAMP")

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: (...args: unknown[]) => docMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  serverTimestamp: () => serverTimestampMock(),
  writeBatch: vi.fn(),
  arrayUnion: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({
  db: { __fake: true },
}))

vi.mock("@/shared/lib/paths", () => {
  const scheduleEntriesPath = (projectId: string, scheduleId: string, clientId: string) => [
    "clients",
    clientId,
    "projects",
    projectId,
    "schedules",
    scheduleId,
    "entries",
  ]
  return {
    schedulesPath: () => [],
    schedulePath: () => [],
    scheduleEntriesPath,
    scheduleDayDetailsPath: () => [],
    scheduleTalentCallsPath: () => [],
    scheduleCrewCallsPath: () => [],
    callSheetConfigPath: () => [],
    locationsPath: () => [],
  }
})

import { upsertScheduleEntry } from "@/features/schedules/lib/scheduleWrites"

describe("upsertScheduleEntry", () => {
  beforeEach(() => {
    setDocMock.mockReset()
    docMock.mockClear()
    serverTimestampMock.mockClear()
    setDocMock.mockResolvedValue(undefined)
  })

  it("writes setDoc at the correct entry path with the patch payload", async () => {
    const result = await upsertScheduleEntry(
      "client-1",
      "project-1",
      "schedule-1",
      "entry-42",
      {
        type: "shot",
        title: "Restored Shot",
        order: 3,
        trackId: "primary",
        startTime: "07:00",
        duration: 15,
      },
    )

    expect(result).toEqual({ id: "entry-42" })
    expect(setDocMock).toHaveBeenCalledTimes(1)

    const [docArg, payload] = setDocMock.mock.calls[0] as [unknown, Record<string, unknown>]
    expect((docArg as { __ref: unknown[] }).__ref).toEqual([
      "clients",
      "client-1",
      "projects",
      "project-1",
      "schedules",
      "schedule-1",
      "entries",
      "entry-42",
    ])
    expect(payload).toEqual({
      type: "shot",
      title: "Restored Shot",
      order: 3,
      trackId: "primary",
      startTime: "07:00",
      duration: 15,
      updatedAt: "MOCK_SERVER_TIMESTAMP",
    })
  })
})
