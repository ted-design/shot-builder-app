import { useMemo } from "react"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useProject } from "@/features/projects/hooks/useProject"
import { useShots } from "@/features/shots/hooks/useShots"
import { useLanes } from "@/features/shots/hooks/useLanes"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { usePulls } from "@/features/pulls/hooks/usePulls"
import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import type {
  Project,
  Shot,
  Lane,
  ProductFamily,
  Pull,
  CrewRecord,
  TalentRecord,
} from "@/shared/types"

export interface ExportData {
  readonly project: Project | null
  readonly shots: readonly Shot[]
  /**
   * Project lanes ("Sets"). Optional so existing hand-built ExportData fixtures
   * (tests that predate the groupBy:"scene" report grouping) keep compiling
   * without updating — every reader treats an absent value as `[]`. The real
   * hook always provides it, fetched the same way the shot list does (useLanes).
   */
  readonly lanes?: readonly Lane[]
  readonly productFamilies: readonly ProductFamily[]
  readonly pulls: readonly Pull[]
  readonly crew: readonly CrewRecord[]
  readonly talent: readonly TalentRecord[]
  readonly loading: boolean
}

/**
 * Aggregation hook that subscribes to all data the export builder needs.
 * Opens 7 concurrent Firestore subscriptions (project, shots, lanes, products,
 * pulls, crew, talent). All use onSnapshot and auto-detach on unmount.
 * Firebase reuses the websocket and caches aggressively, so the overhead
 * is acceptable — matches the CallSheetBuilderPage pattern.
 */
export function useExportData(): ExportData {
  const { projectId } = useProjectScope()

  const { data: project } = useProject(projectId)
  const { data: shots, loading: shotsLoading } = useShots()
  // Mirrors how the shot list fetches lanes (useLanes) — same source, same
  // ordering — so the report's groupBy:"scene" ("Set") grouping can't drift
  // from what the list shows for the same project.
  const { data: lanes, loading: lanesLoading } = useLanes()
  const { data: productFamilies, loading: productsLoading } =
    useProductFamilies()
  const { data: pulls, loading: pullsLoading } = usePulls()
  const { data: crew, loading: crewLoading } = useCrewLibrary()
  const { data: talent, loading: talentLoading } = useTalentLibrary()

  const loading =
    shotsLoading ||
    lanesLoading ||
    productsLoading ||
    pullsLoading ||
    crewLoading ||
    talentLoading

  return useMemo(
    () => ({
      project,
      shots,
      lanes,
      productFamilies,
      pulls,
      crew,
      talent,
      loading,
    }),
    [project, shots, lanes, productFamilies, pulls, crew, talent, loading],
  )
}
