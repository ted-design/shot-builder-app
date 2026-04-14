import {
  createContext,
  useContext,
  type ReactNode,
} from "react"
import { useParams } from "react-router-dom"
import { useProject } from "@/features/projects/hooks/useProject"

interface ProjectScopeContextValue {
  readonly projectId: string
  readonly projectName: string
}

const ProjectScopeContext = createContext<ProjectScopeContextValue | null>(null)

export function ProjectScopeProvider({
  children,
}: {
  readonly children: ReactNode
}) {
  const { id } = useParams<{ id: string }>()

  if (!id) {
    throw new Error(
      "ProjectScopeProvider requires a :id route parameter",
    )
  }

  const { data: project } = useProject(id)

  return (
    <ProjectScopeContext.Provider
      value={{ projectId: id, projectName: project?.name ?? "" }}
    >
      {children}
    </ProjectScopeContext.Provider>
  )
}

export function useProjectScope(): ProjectScopeContextValue {
  const ctx = useContext(ProjectScopeContext)
  if (!ctx) {
    throw new Error("useProjectScope must be used within ProjectScopeProvider")
  }
  return ctx
}

// Non-throwing variant for components that may render on both project-
// scoped and non-project routes (e.g. the shared PageHeader breadcrumb
// resolver). Returns null when no provider is mounted.
export function useOptionalProjectScope(): ProjectScopeContextValue | null {
  return useContext(ProjectScopeContext)
}
