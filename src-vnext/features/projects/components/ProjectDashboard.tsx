import { useState } from "react"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { ProjectCard } from "@/features/projects/components/ProjectCard"
import { CreateProjectDialog } from "@/features/projects/components/CreateProjectDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { FolderKanban, Plus } from "lucide-react"

export default function ProjectDashboard() {
  const { data: projects, loading, error } = useProjects()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const [createOpen, setCreateOpen] = useState(false)

  const showCreate = canManageProjects(role) && !isMobile

  if (loading) {
    return <LoadingState loading />
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Projects"
        actions={
          showCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          ) : undefined
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-12 w-12" />}
          title="No projects yet"
          description="Create your first project to start planning shots."
          actionLabel={showCreate ? "Create Project" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}
    </ErrorBoundary>
  )
}
