import { useMemo } from "react"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useProject } from "@/features/projects/hooks/useProject"
import { useShots } from "@/features/shots/hooks/useShots"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { usePulls } from "@/features/pulls/hooks/usePulls"
import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import type {
  Project,
  Shot,
  ProductFamily,
  Pull,
  CrewRecord,
  TalentRecord,
} from "@/shared/types"

export interface ExportData {
  readonly project: Project | null
  readonly shots: readonly Shot[]
  readonly productFamilies: readonly ProductFamily[]
  readonly pulls: readonly Pull[]
  readonly crew: readonly CrewRecord[]
  readonly talent: readonly TalentRecord[]
  readonly loading: boolean
}

/**
 * Aggregation hook that subscribes to all data the export builder needs.
 * Opens 6 concurrent Firestore subscriptions (project, shots, products,
 * pulls, crew, talent). All use onSnapshot and auto-detach on unmount.
 * Firebase reuses the websocket and caches aggressively, so the overhead
 * is acceptable — matches the CallSheetBuilderPage pattern.
 */
export function useExportData(): ExportData {
  const { projectId } = useProjectScope()

  const { data: project } = useProject(projectId)
  const { data: shots, loading: shotsLoading } = useShots()
  const { data: productFamilies, loading: productsLoading } =
    useProductFamilies()
  const { data: pulls, loading: pullsLoading } = usePulls()
  const { data: crew, loading: crewLoading } = useCrewLibrary()
  const { data: talent, loading: talentLoading } = useTalentLibrary()

  const loading =
    shotsLoading || productsLoading || pullsLoading || crewLoading || talentLoading

  return useMemo(
    () => ({
      project,
      shots,
      productFamilies,
      pulls,
      crew,
      talent,
      loading,
    }),
    [project, shots, productFamilies, pulls, crew, talent, loading],
  )
}
