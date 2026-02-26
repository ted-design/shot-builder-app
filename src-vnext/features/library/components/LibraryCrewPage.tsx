import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { HardHat, Plus, Search } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageCrew } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { useCrewLibrary } from "@/features/library/hooks/useCrewLibrary"
import { CreateCrewDialog } from "./CreateCrewDialog"

function matchesQuery(
  text: string | null | undefined,
  q: string,
): boolean {
  return typeof text === "string" && text.toLowerCase().includes(q)
}

export default function LibraryCrewPage() {
  const { data: crew, loading, error } = useCrewLibrary()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const canCreate = canManageCrew(role)
  const canEdit = !isMobile && canCreate

  const [query, setQuery] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  useKeyboardShortcuts([
    { key: "c", handler: () => { if (canCreate) setCreateOpen(true) } },
  ])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return crew
    return crew.filter(
      (c) =>
        matchesQuery(c.name, q) ||
        matchesQuery(c.firstName, q) ||
        matchesQuery(c.lastName, q) ||
        matchesQuery(c.department, q) ||
        matchesQuery(c.position, q) ||
        matchesQuery(c.email, q) ||
        matchesQuery(c.company, q),
    )
  }, [crew, query])

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  const hasSearch = query.trim().length > 0

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Crew"
          breadcrumbs={[{ label: "Library" }]}
          actions={
            canCreate ? (
              isMobile ? (
                <Button size="icon" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  New Crew Member
                </Button>
              )
            ) : null
          }
        />

        {crew.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-12 w-12" />}
            title="No crew members yet"
            description="Add crew members to assign them to projects and schedules."
            actionLabel={canCreate ? "Add Crew Member" : undefined}
            onAction={canCreate ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* Search toolbar */}
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <Input
                placeholder="Search crew..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                title="No matching crew"
                description="Try adjusting your search."
                actionLabel="Clear search"
                onAction={() => setQuery("")}
              />
            ) : (
              <>
                {hasSearch && (
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    Showing {filtered.length} of {crew.length}
                  </p>
                )}

                <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                        <th className="label-meta px-4 py-3 text-left">Name</th>
                        <th className="label-meta px-4 py-3 text-left">Department</th>
                        {!isMobile && (
                          <>
                            <th className="label-meta px-4 py-3 text-left">Position</th>
                            <th className="label-meta px-4 py-3 text-left">Email</th>
                            <th className="label-meta px-4 py-3 text-left">Company</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr
                          key={c.id}
                          className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-b-0 hover:bg-[var(--color-surface-subtle)]"
                          onClick={() => navigate(`/library/crew/${c.id}`)}
                        >
                          <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)] md:py-3">
                            {c.name}
                          </td>
                          <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)] md:py-3">
                            {c.department ?? "\u2014"}
                          </td>
                          {!isMobile && (
                            <>
                              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                                {c.position ?? "\u2014"}
                              </td>
                              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                                {c.email ?? "\u2014"}
                              </td>
                              <td className="px-4 py-3 text-sm text-[var(--color-text-muted)]">
                                {c.company ?? "\u2014"}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <CreateCrewDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ErrorBoundary>
  )
}
