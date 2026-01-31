import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { Shot } from "@/shared/types"

interface ShotCardProps {
  readonly shot: Shot
}

export function ShotCard({ shot }: ShotCardProps) {
  const navigate = useNavigate()
  const { projectId } = useProjectScope()
  const isMobile = useIsMobile()

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium leading-tight">
          {shot.title || "Untitled Shot"}
        </CardTitle>
        <div onClick={(e) => e.stopPropagation()}>
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            disabled={false}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {shot.description && (
          <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {shot.description}
          </p>
        )}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-subtle)]">
          {shot.products.length > 0 && (
            <span>{shot.products.length} product{shot.products.length !== 1 ? "s" : ""}</span>
          )}
          {shot.talent.length > 0 && (
            <span>{shot.talent.length} talent</span>
          )}
          {shot.locationName && <span>{shot.locationName}</span>}
        </div>
        {isMobile && shot.notes && (
          <p className="mt-1 line-clamp-1 text-xs text-[var(--color-text-subtle)]">
            {shot.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
