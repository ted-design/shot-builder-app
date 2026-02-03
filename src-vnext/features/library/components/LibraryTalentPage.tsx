import { useMemo, useState } from "react"
import { Users } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { PageHeader } from "@/shared/components/PageHeader"
import { useTalent } from "@/features/shots/hooks/usePickerData"
import { Input } from "@/ui/input"
import { Card, CardContent } from "@/ui/card"

export default function LibraryTalentPage() {
  const { data: talent, loading, error } = useTalent()
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return talent
    return talent.filter((t) => t.name.toLowerCase().includes(q))
  }, [query, talent])

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
      <PageHeader title="Talent" breadcrumbs={[{ label: "Library" }]} />

      {talent.length === 0 ? (
        <EmptyState
          icon={<Users className="h-12 w-12" />}
          title="No talent yet"
          description="Talent profiles will appear here."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="max-w-md">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search talent…"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
              <p className="text-sm text-[var(--color-text-muted)]">No results.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((t) => (
                <Card key={t.id}>
                  <CardContent className="py-4">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {t.name}
                    </div>
                    {t.agency ? (
                      <div className="mt-1 text-xs text-[var(--color-text-muted)]">
                        {t.agency}
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

