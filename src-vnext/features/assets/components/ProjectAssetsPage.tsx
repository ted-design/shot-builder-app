import { useMemo, type ReactNode } from "react"
import { Package, Users, MapPin, Image as ImageIcon } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageHeader } from "@/shared/components/PageHeader"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useShots } from "@/features/shots/hooks/useShots"
import { useTalent, useLocations, useProductFamilies } from "@/features/shots/hooks/usePickerData"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import type { Shot } from "@/shared/types"

type UsageRow = {
  readonly id: string
  readonly label: string
  readonly count: number
  readonly sublabel?: string
}

function countHeroImages(shots: readonly Shot[]): number {
  let count = 0
  for (const shot of shots) {
    if (shot.heroImage?.path) count += 1
  }
  return count
}

export default function ProjectAssetsPage() {
  const { projectId, projectName } = useProjectScope()
  const { data: shots, loading: shotsLoading, error: shotsError } = useShots()
  const { data: talent, loading: talentLoading, error: talentError } = useTalent()
  const { data: locations, loading: locationsLoading, error: locationsError } = useLocations()
  const { data: families, loading: familiesLoading, error: familiesError } = useProductFamilies()

  const loading = shotsLoading || talentLoading || locationsLoading || familiesLoading
  const error = shotsError || talentError || locationsError || familiesError

  const heroCount = useMemo(() => countHeroImages(shots), [shots])

  const talentRows = useMemo(() => {
    const usage = new Map<string, number>()
    for (const shot of shots) {
      const ids = shot.talentIds ?? []
      for (const id of ids) {
        if (!id) continue
        usage.set(id, (usage.get(id) ?? 0) + 1)
      }
    }

    const byId = new Map(talent.map((t) => [t.id, t]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.name ?? `Missing (${id})`,
        sublabel: byId.get(id)?.agency ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, talent])

  const locationRows = useMemo(() => {
    const usage = new Map<string, number>()
    const fallback = new Map<string, string>()
    for (const shot of shots) {
      const id = shot.locationId
      if (!id) continue
      usage.set(id, (usage.get(id) ?? 0) + 1)
      if (shot.locationName) fallback.set(id, shot.locationName)
    }

    const byId = new Map(locations.map((l) => [l.id, l]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.name ?? fallback.get(id) ?? `Missing (${id})`,
        sublabel: byId.get(id)?.address ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, locations])

  const productRows = useMemo(() => {
    const usage = new Map<string, number>()
    const fallback = new Map<string, string>()
    for (const shot of shots) {
      for (const assignment of shot.products) {
        const id = assignment.familyId
        if (!id) continue
        usage.set(id, (usage.get(id) ?? 0) + 1)
        if (assignment.familyName) fallback.set(id, assignment.familyName)
      }
    }

    const byId = new Map(families.map((f) => [f.id, f]))
    return [...usage.entries()]
      .map(([id, count]) => ({
        id,
        count,
        label: byId.get(id)?.styleName ?? fallback.get(id) ?? `Missing (${id})`,
        sublabel: byId.get(id)?.styleNumber ?? undefined,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  }, [shots, families])

  if (loading) return <LoadingState loading />

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
        title="Assets"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || projectId || "Project" },
        ]}
      />

      {shots.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="h-12 w-12" />}
          title="No shots yet"
          description="Assets are derived from shot assignments."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <AssetCard
            title="Talent"
            icon={<Users className="h-4 w-4" />}
            rows={talentRows}
            emptyLabel="No talent assigned"
          />
          <AssetCard
            title="Locations"
            icon={<MapPin className="h-4 w-4" />}
            rows={locationRows}
            emptyLabel="No locations assigned"
          />
          <AssetCard
            title="Products"
            icon={<Package className="h-4 w-4" />}
            rows={productRows}
            emptyLabel="No products assigned"
          />

          <Card className="lg:col-span-3">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Images</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6">
              <div>
                <div className="text-2xl font-semibold text-[var(--color-text)]">
                  {heroCount}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Shots with hero images
                </div>
              </div>
              <div>
                <div className="text-2xl font-semibold text-[var(--color-text)]">
                  {shots.length}
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  Total shots
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </ErrorBoundary>
  )
}

function AssetCard({
  title,
  icon,
  rows,
  emptyLabel,
}: {
  readonly title: string
  readonly icon: ReactNode
  readonly rows: readonly UsageRow[]
  readonly emptyLabel: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
          <span className="ml-auto text-xs font-normal text-[var(--color-text-muted)]">
            {rows.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--color-text-muted)]">{emptyLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.slice(0, 18).map((row) => (
              <div
                key={row.id}
                className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--color-text)]">
                    {row.label}
                  </div>
                  {row.sublabel ? (
                    <div className="truncate text-xs text-[var(--color-text-muted)]">
                      {row.sublabel}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-[var(--color-text-muted)]">
                  {row.count} shot{row.count === 1 ? "" : "s"}
                </div>
              </div>
            ))}
            {rows.length > 18 ? (
              <p className="text-xs text-[var(--color-text-muted)]">
                Showing top 18 by usage.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
