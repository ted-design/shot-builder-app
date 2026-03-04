import { useState } from "react"
import { UserPlus } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { Button } from "@/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/tabs"
import { useAuth } from "@/app/providers/AuthProvider"
import { useUsers } from "@/features/admin/hooks/useUsers"
import { usePendingInvitations } from "@/features/admin/hooks/usePendingInvitations"
import { InviteUserDialog } from "./InviteUserDialog"
import { ProjectAccessTab } from "./ProjectAccessTab"
import { TeamRosterTab } from "./TeamRosterTab"

export default function AdminPage() {
  const { data: users, loading, error } = useUsers()
  const { data: pendingInvitations } = usePendingInvitations()
  const { user, clientId } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [tab, setTab] = useState("team")

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Team"
          actions={
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          }
        />

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="project-access" data-value="project-access">
              Project Access
            </TabsTrigger>
          </TabsList>

          <TabsContent value="team">
            <TeamRosterTab
              users={users}
              pendingInvitations={pendingInvitations}
              currentUserId={user?.uid}
              clientId={clientId ?? undefined}
              onInvite={() => setInviteOpen(true)}
            />
          </TabsContent>

          <TabsContent value="project-access">
            <ProjectAccessTab />
          </TabsContent>
        </Tabs>
      </div>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </ErrorBoundary>
  )
}
