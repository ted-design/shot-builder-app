import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { getPullStatusLabel, getPullStatusColor } from "@/shared/lib/statusMappings"
import type { Pull } from "@/shared/types"

interface PullCardProps {
  readonly pull: Pull
}

export function PullCard({ pull }: PullCardProps) {
  const navigate = useNavigate()
  const { projectId } = useProjectScope()

  const fulfilledCount = pull.items.filter(
    (item) => item.fulfillmentStatus === "fulfilled",
  ).length

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${projectId}/pulls/${pull.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium leading-tight">
          {pull.name || `Pull Sheet`}
        </CardTitle>
        <StatusBadge
          label={getPullStatusLabel(pull.status)}
          color={getPullStatusColor(pull.status)}
        />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
          <span>{pull.items.length} item{pull.items.length !== 1 ? "s" : ""}</span>
          {pull.items.length > 0 && (
            <span>
              {fulfilledCount}/{pull.items.length} fulfilled
            </span>
          )}
          {pull.shareEnabled && (
            <span className="text-[var(--color-info)]">Shared</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
