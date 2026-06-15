import { useMemo, useReducer, type Dispatch, type SetStateAction } from "react"
import type { CastingSession, TalentImage } from "@/features/library/components/talentUtils"

/**
 * Consolidated state for the six removal / create-session / print dialogs that
 * LibraryTalentPage drives. Phase 0b of the Talent redesign replaces ten loose
 * `useState` cells in the orchestrator with this single reducer-backed hook.
 *
 * Pure refactor: the returned setters are faithful `Dispatch<SetStateAction<T>>`
 * drop-ins for the prior `useState` setters, so consumer behaviour is identical.
 * (`busy`, `sessionExpanded`, and `createOpen` are intentionally NOT here — they
 * are not removal/create-session dialog state and move in later phases.)
 */
export interface TalentDialogsState {
  readonly headshotRemoveOpen: boolean
  readonly galleryRemoveOpen: boolean
  readonly galleryRemoveTarget: TalentImage | null
  readonly sessionRemoveOpen: boolean
  readonly sessionRemoveTarget: CastingSession | null
  readonly deleteOpen: boolean
  readonly createSessionOpen: boolean
  readonly createSessionDate: string
  readonly createSessionTitle: string
  readonly printSessionId: string | null
}

/** One action per field; `value` mirrors React's `SetStateAction` (value or updater fn). */
type TalentDialogsAction = {
  readonly [K in keyof TalentDialogsState]: {
    readonly field: K
    readonly value: SetStateAction<TalentDialogsState[K]>
  }
}[keyof TalentDialogsState]

/** Resolves a `SetStateAction` against the previous value, exactly as React does internally. */
function applySetStateAction<T>(value: SetStateAction<T>, prev: T): T {
  return typeof value === "function" ? (value as (prevState: T) => T)(prev) : value
}

export function createTalentDialogsState(): TalentDialogsState {
  return {
    headshotRemoveOpen: false,
    galleryRemoveOpen: false,
    galleryRemoveTarget: null,
    sessionRemoveOpen: false,
    sessionRemoveTarget: null,
    deleteOpen: false,
    createSessionOpen: false,
    createSessionDate: new Date().toISOString().slice(0, 10),
    createSessionTitle: "",
    printSessionId: null,
  }
}

export function talentDialogsReducer(
  state: TalentDialogsState,
  action: TalentDialogsAction,
): TalentDialogsState {
  const prev = state[action.field]
  // The per-field action union guarantees `value` matches the field's type, but
  // TypeScript can't correlate the two across the union, so we re-narrow here.
  const next = applySetStateAction(action.value as SetStateAction<typeof prev>, prev)
  if (Object.is(prev, next)) return state
  return { ...state, [action.field]: next }
}

export interface TalentDialogsApi extends TalentDialogsState {
  readonly setHeadshotRemoveOpen: Dispatch<SetStateAction<boolean>>
  readonly setGalleryRemoveOpen: Dispatch<SetStateAction<boolean>>
  readonly setGalleryRemoveTarget: Dispatch<SetStateAction<TalentImage | null>>
  readonly setSessionRemoveOpen: Dispatch<SetStateAction<boolean>>
  readonly setSessionRemoveTarget: Dispatch<SetStateAction<CastingSession | null>>
  readonly setDeleteOpen: Dispatch<SetStateAction<boolean>>
  readonly setCreateSessionOpen: Dispatch<SetStateAction<boolean>>
  readonly setCreateSessionDate: Dispatch<SetStateAction<string>>
  readonly setCreateSessionTitle: Dispatch<SetStateAction<string>>
  readonly setPrintSessionId: Dispatch<SetStateAction<string | null>>
}

export function useTalentDialogs(): TalentDialogsApi {
  const [state, dispatch] = useReducer(talentDialogsReducer, undefined, createTalentDialogsState)

  // Stable setter identities (dispatch is stable) — drop-in for useState setters.
  const setters = useMemo(
    () => ({
      setHeadshotRemoveOpen: (value: SetStateAction<boolean>) =>
        dispatch({ field: "headshotRemoveOpen", value }),
      setGalleryRemoveOpen: (value: SetStateAction<boolean>) =>
        dispatch({ field: "galleryRemoveOpen", value }),
      setGalleryRemoveTarget: (value: SetStateAction<TalentImage | null>) =>
        dispatch({ field: "galleryRemoveTarget", value }),
      setSessionRemoveOpen: (value: SetStateAction<boolean>) =>
        dispatch({ field: "sessionRemoveOpen", value }),
      setSessionRemoveTarget: (value: SetStateAction<CastingSession | null>) =>
        dispatch({ field: "sessionRemoveTarget", value }),
      setDeleteOpen: (value: SetStateAction<boolean>) => dispatch({ field: "deleteOpen", value }),
      setCreateSessionOpen: (value: SetStateAction<boolean>) =>
        dispatch({ field: "createSessionOpen", value }),
      setCreateSessionDate: (value: SetStateAction<string>) =>
        dispatch({ field: "createSessionDate", value }),
      setCreateSessionTitle: (value: SetStateAction<string>) =>
        dispatch({ field: "createSessionTitle", value }),
      setPrintSessionId: (value: SetStateAction<string | null>) =>
        dispatch({ field: "printSessionId", value }),
    }),
    [],
  )

  return { ...state, ...setters }
}
