import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MapPin, Plus, Search } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageLocations } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { useLocationLibrary } from "@/features/library/hooks/useLocationLibrary"
import { CreateLocationDialog } from "@/features/library/components/CreateLocationDialog"

export default function LibraryLocationsPage() {
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const { data: locations, loading, error } = useLocationLibrary()
  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const canCreate = canManageLocations(role)

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
            {/* Toolbar: search */}
            <div className="flex items-center justify-between gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
                <Input
                  placeholder="Search locations..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9 text-sm"
                />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="No matching locations"
                description="Try adjusting your search."
                actionLabel="Clear search"
                onAction={() => setQuery("")}
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
                          {loc.address ?? "—"}
                        </td>
                        {!isMobile && (
                          <td className="px-4 py-3 text-[var(--color-text-muted)]">
                            {loc.phone ?? "—"}
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
