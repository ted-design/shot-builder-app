import {
  createContext,
  useContext,
  type ReactNode,
} from "react"
import { useParams } from "react-router-dom"

interface ProjectScopeContextValue {
  readonly projectId: string
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

  return (
    <ProjectScopeContext.Provider value={{ projectId: id }}>
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
