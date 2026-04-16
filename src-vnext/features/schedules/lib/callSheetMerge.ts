import type { CrewCallSheet, TalentCallSheet } from "@/shared/types"

export interface CrewVisibility {
  readonly isVisible: boolean
  readonly showEmail: boolean
  readonly showPhone: boolean
}

export interface TalentVisibility {
  readonly isVisible: boolean
}

export interface CrewMergeContext {
  readonly globalShowEmail?: boolean | null
  readonly globalShowPhone?: boolean | null
}

export function mergeCrewWithOverride(
  override: CrewCallSheet | null | undefined,
  context?: CrewMergeContext,
): CrewVisibility {
  const isVisible = override?.isVisibleOverride !== false

  const globalEmail = context?.globalShowEmail ?? true
  const globalPhone = context?.globalShowPhone ?? true

  const showEmail = globalEmail
    ? (override?.showEmailOverride !== false)
    : false

  const showPhone = globalPhone
    ? (override?.showPhoneOverride !== false)
    : false

  return { isVisible, showEmail, showPhone }
}

export function mergeTalentWithOverride(
  override: TalentCallSheet | null | undefined,
): TalentVisibility {
  return { isVisible: override?.isVisibleOverride !== false }
}
