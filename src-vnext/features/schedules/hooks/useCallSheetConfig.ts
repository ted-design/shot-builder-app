import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { callSheetConfigPath } from "@/shared/lib/paths"
import { upsertCallSheetConfig } from "@/features/schedules/lib/scheduleWrites"
import {
  mergeLegacyColors,
  mergeLegacyScheduleBlockFields,
  normalizeCallSheetConfig,
  upsertLegacySectionVisibility,
} from "@/features/schedules/lib/callSheetConfig"
import type {
  CallSheetColors,
  CallSheetConfig,
  CallSheetSectionVisibility,
  ScheduleBlockFields,
} from "@/features/schedules/components/CallSheetRenderer"

type CallSheetConfigDoc = Record<string, unknown> & { readonly id: string }

function mapConfigDoc(id: string, data: Record<string, unknown>): CallSheetConfigDoc {
  return { ...data, id }
}

export function useCallSheetConfig(
  clientId: string | null,
  projectId: string,
  scheduleId: string | null,
) {
  const {
    data: raw,
    loading,
    error,
  } = useFirestoreDoc<CallSheetConfigDoc>(
    clientId && scheduleId ? callSheetConfigPath(projectId, scheduleId, clientId) : null,
    mapConfigDoc,
  )

  const config = useMemo<CallSheetConfig>(() => normalizeCallSheetConfig(raw), [raw])

  const setSectionVisibility = useCallback(
    async (patch: Partial<Required<CallSheetSectionVisibility>>) => {
      if (!clientId || !scheduleId) return
      try {
        const nextSections = upsertLegacySectionVisibility(raw, patch)
        await upsertCallSheetConfig(clientId, projectId, scheduleId, {
          sections: nextSections,
        })
      } catch (err) {
        toast.error("Failed to save section visibility.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, raw],
  )

  const setScheduleBlockFields = useCallback(
    async (patch: Partial<Required<ScheduleBlockFields>>) => {
      if (!clientId || !scheduleId) return
      try {
        const nextFields = mergeLegacyScheduleBlockFields(raw, patch)
        await upsertCallSheetConfig(clientId, projectId, scheduleId, {
          scheduleBlockFields: nextFields,
        })
      } catch (err) {
        toast.error("Failed to save schedule fields.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, raw],
  )

  const setColors = useCallback(
    async (patch: Partial<Required<CallSheetColors>>) => {
      if (!clientId || !scheduleId) return
      try {
        const nextColors = mergeLegacyColors(raw, patch)
        await upsertCallSheetConfig(clientId, projectId, scheduleId, {
          colors: nextColors,
        })
      } catch (err) {
        toast.error("Failed to save colors.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, raw],
  )

  return {
    raw,
    config,
    loading,
    error,
    setSectionVisibility,
    setScheduleBlockFields,
    setColors,
  }
}

