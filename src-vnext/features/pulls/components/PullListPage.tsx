import { useState } from "react"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { usePulls } from "@/features/pulls/hooks/usePulls"
import { PullCard } from "@/features/pulls/components/PullCard"
import { CreatePullDialog } from "@/features/pulls/components/CreatePullDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canManagePulls } from "@/shared/lib/rbac"
import { Button } from "@/ui/button"
import { ClipboardList, Plus } from "lucide-react"

export default function PullListPage() {
  const { data: pulls, loading, error } = usePulls()
  const { role } = useAuth()
  const { projectName } = useProjectScope()
  const [createOpen, setCreateOpen] = useState(false)

  const showCreate = canManagePulls(role)

  if (loading) {
    return <LoadingState loading skeleton={<ListPageSkeleton />} />
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
        title="Pull Sheets"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || "Project" },
        ]}
        actions={
          showCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Pull Sheet
            </Button>
          ) : undefined
        }
      />

      {pulls.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-12 w-12" />}
          title="No pull sheets yet"
          description="Generate a pull sheet from your shots."
          actionLabel={showCreate ? "Create Pull Sheet" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pulls.map((pull) => (
            <PullCard key={pull.id} pull={pull} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreatePullDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </ErrorBoundary>
  )
}
