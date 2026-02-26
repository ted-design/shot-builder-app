import { useMemo, useState } from "react"
import { MapPin, Search } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { PageHeader } from "@/shared/components/PageHeader"
import { useLocations } from "@/features/shots/hooks/usePickerData"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"

export default function LibraryLocationsPage() {
  const { data: locations, loading, error } = useLocations()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return locations
    return locations.filter((loc) => {
      const name = loc.name.toLowerCase()
      const address = (loc.address ?? "").toLowerCase()
      return name.includes(q) || address.includes(q)
    })
  }, [locations, query])

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
      <PageHeader title="Locations" breadcrumbs={[{ label: "Library" }]} />

      {locations.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-12 w-12" />}
          title="No locations yet"
          description="Locations will appear here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search locations…"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-12 w-12" />}
              title="No matching locations"
              description="Try adjusting your search."
              actionLabel="Clear search"
              onAction={() => setQuery("")}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((loc) => (
                <Card key={loc.id}>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {loc.name}
                    </div>
                    {loc.address ? (
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {loc.address}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </ErrorBoundary>
  )
}

