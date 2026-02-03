import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Package, Users, MapPin } from "lucide-react"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot } from "@/shared/types"

interface ShotCardProps {
  readonly shot: Shot
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onSelectedChange?: (selected: boolean) => void
}

export function ShotCard({
  shot,
  selectable,
  selected,
  onSelectedChange,
}: ShotCardProps) {
  const navigate = useNavigate()
  const { projectId } = useProjectScope()
  const [imgVisible, setImgVisible] = useState(!!shot.heroImage?.downloadURL)

  const hasProducts = shot.products.length > 0
  const hasTalent = (shot.talentIds ?? shot.talent).length > 0
  const hasLocation = !!shot.locationId
  const heroUrl = shot.heroImage?.downloadURL

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {heroUrl && imgVisible && (
            <img
              src={heroUrl}
              alt={shot.title || "Shot image"}
              className="h-10 w-10 flex-shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] object-cover"
              onError={() => setImgVisible(false)}
            />
          )}
          <div className="flex items-baseline gap-2 min-w-0">
            <CardTitle className="text-sm font-medium leading-tight truncate">
              {shot.title || "Untitled Shot"}
            </CardTitle>
            {shot.shotNumber && (
              <span className="text-xs text-[var(--color-text-subtle)] flex-shrink-0">
                #{shot.shotNumber}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {selectable && (
            <Checkbox
              checked={!!selected}
              onCheckedChange={(v) => {
                if (v === "indeterminate") return
                onSelectedChange?.(v)
              }}
              aria-label={selected ? "Deselect shot" : "Select shot"}
            />
          )}
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            disabled={false}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {shot.description && textPreview(shot.description) && (
          <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {textPreview(shot.description)}
          </p>
        )}

        {/* Readiness indicators */}
        <div className="flex items-center gap-3 text-xs">
          <ReadinessIndicator icon={Package} ready={hasProducts} label="Products" />
          <ReadinessIndicator icon={Users} ready={hasTalent} label="Talent" />
          <ReadinessIndicator icon={MapPin} ready={hasLocation} label="Location" />
        </div>

        {/* Tag badges (read-only) */}
        {shot.tags && shot.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shot.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="text-[10px]"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.label}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReadinessIndicator({
  icon: Icon,
  ready,
  label,
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly ready: boolean
  readonly label: string
}) {
  return (
    <span
      className={`flex items-center gap-1 ${
        ready
          ? "text-[var(--color-text-secondary)]"
          : "text-[var(--color-text-subtle)] opacity-50"
      }`}
      title={ready ? `${label} assigned` : `No ${label.toLowerCase()}`}
    >
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  )
}
