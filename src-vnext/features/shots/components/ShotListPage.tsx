import { useState } from "react"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotCard } from "@/features/shots/components/ShotCard"
import { CreateShotDialog } from "@/features/shots/components/CreateShotDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { Button } from "@/ui/button"
import { Camera, Plus } from "lucide-react"

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { role } = useAuth()
  const [createOpen, setCreateOpen] = useState(false)

  const showCreate = canManageShots(role)

  if (loading) {
    return <LoadingState loading />
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shots"
        actions={
          showCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Shot
            </Button>
          ) : undefined
        }
      />

      {shots.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-12 w-12" />}
          title="No shots yet"
          description="Create your first shot to start building your project."
          actionLabel={showCreate ? "Create Shot" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shots.map((shot) => (
            <ShotCard key={shot.id} shot={shot} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateShotDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </ErrorBoundary>
  )
}
