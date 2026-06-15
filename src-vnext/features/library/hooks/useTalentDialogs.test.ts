import { describe, it, expect } from "vitest"
import { act, renderHook } from "@testing-library/react"
import type { CastingSession, TalentImage } from "@/features/library/components/talentUtils"
import {
  createTalentDialogsState,
  talentDialogsReducer,
  useTalentDialogs,
  type TalentDialogsState,
} from "@/features/library/hooks/useTalentDialogs"

// The reducer stores these as opaque references (it never reads their fields),
// so minimal literals are sufficient for transition tests.
const IMG = { id: "img-1" } as TalentImage
const SESSION = { id: "sess-1" } as CastingSession

describe("createTalentDialogsState", () => {
  it("returns all dialogs closed with empty targets", () => {
    const s = createTalentDialogsState()
    expect(s).toMatchObject({
      headshotRemoveOpen: false,
      galleryRemoveOpen: false,
      galleryRemoveTarget: null,
      sessionRemoveOpen: false,
      sessionRemoveTarget: null,
      deleteOpen: false,
      createSessionOpen: false,
      createSessionTitle: "",
      printSessionId: null,
    })
  })

  it("defaults the create-session date to today (YYYY-MM-DD)", () => {
    expect(createTalentDialogsState().createSessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe("talentDialogsReducer", () => {
  const base: TalentDialogsState = createTalentDialogsState()

  it("sets a boolean field without touching others", () => {
    const next = talentDialogsReducer(base, { field: "deleteOpen", value: true })
    expect(next.deleteOpen).toBe(true)
    expect(next.headshotRemoveOpen).toBe(false)
    expect(next.createSessionOpen).toBe(false)
  })

  it("sets and clears object targets", () => {
    const withTarget = talentDialogsReducer(base, { field: "galleryRemoveTarget", value: IMG })
    expect(withTarget.galleryRemoveTarget).toBe(IMG)
    const cleared = talentDialogsReducer(withTarget, { field: "galleryRemoveTarget", value: null })
    expect(cleared.galleryRemoveTarget).toBeNull()
  })

  it("stores a session target and a print id", () => {
    const a = talentDialogsReducer(base, { field: "sessionRemoveTarget", value: SESSION })
    expect(a.sessionRemoveTarget).toBe(SESSION)
    const b = talentDialogsReducer(base, { field: "printSessionId", value: "s1" })
    expect(b.printSessionId).toBe("s1")
  })

  it("supports the functional-updater form of SetStateAction", () => {
    const next = talentDialogsReducer(base, {
      field: "deleteOpen",
      value: (prev) => !prev,
    })
    expect(next.deleteOpen).toBe(true)
  })

  it("returns the SAME state reference when the value is unchanged (no needless re-render)", () => {
    const next = talentDialogsReducer(base, { field: "headshotRemoveOpen", value: false })
    expect(next).toBe(base)
  })

  it("does not mutate the previous state", () => {
    const before = { ...base }
    talentDialogsReducer(base, { field: "createSessionTitle", value: "Jan 30" })
    expect(base).toEqual(before)
  })
})

describe("useTalentDialogs", () => {
  it("exposes the initial state and all setters", () => {
    const { result } = renderHook(() => useTalentDialogs())
    expect(result.current.headshotRemoveOpen).toBe(false)
    expect(result.current.createSessionTitle).toBe("")
    expect(typeof result.current.setDeleteOpen).toBe("function")
    expect(typeof result.current.setPrintSessionId).toBe("function")
  })

  it("updates state through a setter", () => {
    const { result } = renderHook(() => useTalentDialogs())
    act(() => result.current.setCreateSessionOpen(true))
    expect(result.current.createSessionOpen).toBe(true)
    act(() => result.current.setCreateSessionTitle("Jan 30 casting"))
    expect(result.current.createSessionTitle).toBe("Jan 30 casting")
  })

  it("supports functional updaters through a setter", () => {
    const { result } = renderHook(() => useTalentDialogs())
    act(() => result.current.setDeleteOpen((prev) => !prev))
    expect(result.current.deleteOpen).toBe(true)
  })

  it("keeps setter identities stable across renders", () => {
    const { result, rerender } = renderHook(() => useTalentDialogs())
    const first = result.current.setDeleteOpen
    act(() => result.current.setHeadshotRemoveOpen(true))
    rerender()
    expect(result.current.setDeleteOpen).toBe(first)
  })
})
