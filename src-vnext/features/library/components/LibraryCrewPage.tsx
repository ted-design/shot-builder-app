import { useMemo, useState } from "react"
import { HardHat } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { PageHeader } from "@/shared/components/PageHeader"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"
import { useAuth } from "@/app/providers/AuthProvider"
import { useCrew } from "@/features/schedules/hooks/useCrew"

export default function LibraryCrewPage() {
  const { clientId } = useAuth()
  const { data: crew, loading, error } = useCrew(clientId)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return crew
    return crew.filter((c) => {
      const name = c.name.toLowerCase()
      const dept = (c.department ?? "").toLowerCase()
      const position = (c.position ?? "").toLowerCase()
      return name.includes(q) || dept.includes(q) || position.includes(q)
    })
  }, [crew, query])

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
      <PageHeader title="Crew" breadcrumbs={[{ label: "Library" }]} />

      {crew.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-12 w-12" />}
          title="No crew yet"
          description="Crew will appear here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search crew…"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">No results.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {c.name}
                    </div>
                    {c.department || c.position ? (
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {[c.department, c.position].filter(Boolean).join(" • ")}
                      </div>
                    ) : null}
                    {c.email ? (
                      <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                        {c.email}
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

