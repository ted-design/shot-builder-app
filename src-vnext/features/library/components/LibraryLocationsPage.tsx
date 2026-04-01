import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Plus, Search, LayoutList, Table2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageLocations } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { Button } from "@/ui/button"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { useLocationLibrary } from "@/features/library/hooks/useLocationLibrary"
import { CreateLocationDialog } from "@/features/library/components/CreateLocationDialog"
import { LocationsTable } from "@/features/library/components/LocationsTable"
import { ViewModeToggle } from "@/shared/components/ViewModeToggle"
import { SearchBar } from "@/shared/components/SearchBar"
import { usePersistedViewMode } from "@/shared/hooks/usePersistedViewMode"

const LOCATIONS_VIEW_MODES = ["list", "table"] as const

const LOCATIONS_VIEW_OPTIONS = [
  { key: "list", icon: LayoutList, label: "List view" },
  { key: "table", icon: Table2, label: "Table view" },
] as const

export default function LibraryLocationsPage() {
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { data: locations, loading, error } = useLocationLibrary()
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const canCreate = canManageLocations(role)
  const [viewMode, setViewMode] = usePersistedViewMode("sb:locations-view", "list", LOCATIONS_VIEW_MODES)

  useKeyboardShortcuts([
    { key: "c", handler: () => { if (canCreate) setCreateOpen(true) } },
  ])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return locations
    return locations.filter((loc) => {
      const name = loc.name.toLowerCase()
      const address = (loc.address ?? "").toLowerCase()
      const phone = (loc.phone ?? "").toLowerCase()
      const notes = (loc.notes ?? "").toLowerCase()
      return (
        name.includes(q) ||
        address.includes(q) ||
        phone.includes(q) ||
        notes.includes(q)
      )
    })
  }, [locations, query])

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
          title="Locations"
          breadcrumbs={[{ label: "Library" }]}
          actions={
            canCreate ? (
              isMobile ? (
                <Button size="icon" aria-label="New location" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Location
                </Button>
              )
            ) : null
          }
        />

        {locations.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-10 w-10" />}
            title="No locations yet"
            description="Add locations to assign them to shots and schedules."
            actionLabel={canCreate ? "Add Location" : undefined}
            onAction={canCreate ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Toolbar: search + view toggle */}
            <div className="flex items-center justify-between gap-3">
              <SearchBar
                value={query}
                onChange={setQuery}
                placeholder="Search locations..."
                className="max-w-sm flex-1"
              />
              <ViewModeToggle
                modes={LOCATIONS_VIEW_OPTIONS}
                activeMode={viewMode}
                onChange={(mode) => setViewMode(mode as "list" | "table")}
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="No matching locations"
                description="Try adjusting your search."
                actionLabel="Clear search"
                onAction={() => setQuery("")}
              />
            ) : viewMode === "table" ? (
              <LocationsTable
                locations={filtered}
                onSelect={(id) => navigate(`/library/locations/${id}`)}
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                      <th className="label-meta px-4 py-2 text-left font-semibold">
                        Name
                      </th>
                      <th className="label-meta px-4 py-2 text-left font-semibold">
                        Address
                      </th>
                      {!isMobile && (
                        <th className="label-meta px-4 py-2 text-left font-semibold">
                          Phone
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((loc) => (
                      <tr
                        key={loc.id}
                        className="cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-subtle)]"
                        onClick={() =>
                          navigate(`/library/locations/${loc.id}`)
                        }
                      >
                        <td className="px-4 py-2.5 font-medium text-[var(--color-text)] md:py-3">
                          {loc.name}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-text-muted)] md:py-3">
                          {loc.address ?? "\u2014"}
                        </td>
                        {!isMobile && (
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {loc.phone ?? "\u2014"}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateLocationDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ErrorBoundary>
  )
}
