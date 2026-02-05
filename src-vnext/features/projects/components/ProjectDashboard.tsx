import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { ProjectCard } from "@/features/projects/components/ProjectCard"
import { CreateProjectDialog } from "@/features/projects/components/CreateProjectDialog"
import { EditProjectDialog } from "@/features/projects/components/EditProjectDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Skeleton } from "@/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"
import { FolderKanban, Plus, Search, SlidersHorizontal } from "lucide-react"

type ProjectFilter = "active" | "completed" | "archived" | "all"
type ProjectSort = "recent" | "shootDate" | "name"

const FILTER_LABELS: Record<ProjectFilter, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
  all: "All",
}

const SORT_LABELS: Record<ProjectSort, string> = {
  recent: "Most Recent",
  shootDate: "Shoot Date",
  name: "Name",
}

function normalizeFilter(value: string | null): ProjectFilter {
  if (value === "completed" || value === "archived" || value === "all") return value
  return "active"
}

function normalizeSort(value: string | null): ProjectSort {
  if (value === "shootDate" || value === "name") return value
  return "recent"
}

export default function ProjectDashboard() {
  const { data: projects, loading, error } = useProjects()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)

  const canManage = canManageProjects(role)
  const showCreate = canManage && !isMobile
  const showActions = canManage && !isMobile

  const filter = normalizeFilter(searchParams.get("filter"))
  const sort = normalizeSort(searchParams.get("sort"))
  const queryParam = searchParams.get("q") ?? ""

  const [queryDraft, setQueryDraft] = useState(queryParam)
  useEffect(() => setQueryDraft(queryParam), [queryParam])

  useEffect(() => {
    if (queryDraft === queryParam) return
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const q = queryDraft.trim()
      if (!q) next.delete("q")
      else next.set("q", q)
      setSearchParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(t)
  }, [queryDraft, queryParam, searchParams, setSearchParams])

  const setFilter = (value: ProjectFilter) => {
    const next = new URLSearchParams(searchParams)
    if (value === "active") next.delete("filter")
    else next.set("filter", value)
    setSearchParams(next, { replace: true })
  }

  const setSort = (value: ProjectSort) => {
    const next = new URLSearchParams(searchParams)
    if (value === "recent") next.delete("sort")
    else next.set("sort", value)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("q")
    next.delete("filter")
    next.delete("sort")
    setSearchParams(next, { replace: true })
  }

  const baseProjects = useMemo(() => {
    return projects.filter((p) => !p.deletedAt)
  }, [projects])

  const editingProject = useMemo(() => {
    if (!editingProjectId) return null
    return baseProjects.find((p) => p.id === editingProjectId) ?? null
  }, [baseProjects, editingProjectId])

  const displayProjects = useMemo(() => {
    const q = queryParam.trim().toLowerCase()
    const filtered = baseProjects.filter((p) => {
      const status = p.status ?? "active"
      if (filter === "active") {
        if (status === "archived" || status === "completed") return false
      } else if (filter === "completed") {
        if (status !== "completed") return false
      } else if (filter === "archived") {
        if (status !== "archived") return false
      }

      if (!q) return true
      const haystack = `${p.name ?? ""} ${p.notes ?? ""} ${p.briefUrl ?? ""}`.toLowerCase()
      return haystack.includes(q)
    })

    if (sort === "name") {
      const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
      return [...filtered].sort((a, b) => collator.compare(a.name ?? "", b.name ?? ""))
    }

    if (sort === "shootDate") {
      return [...filtered].sort((a, b) => {
        const A = a.shootDates?.[0] ?? "9999-12-31"
        const B = b.shootDates?.[0] ?? "9999-12-31"
        const cmp = A.localeCompare(B)
        if (cmp !== 0) return cmp
        return (a.name ?? "").localeCompare(b.name ?? "")
      })
    }

    // recent
    return [...filtered].sort((a, b) => {
      const aMs = a.updatedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0
      const bMs = b.updatedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0
      return bMs - aMs
    })
  }, [baseProjects, filter, queryParam, sort])

  const activeBadges = useMemo(() => {
    const badges: Array<{ readonly key: string; readonly label: string; readonly onRemove: () => void }> = []
    if (queryParam.trim()) {
      badges.push({
        key: "q",
        label: `Search: ${queryParam.trim()}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams)
          next.delete("q")
          setSearchParams(next, { replace: true })
        },
      })
    }
    if (filter !== "active") {
      badges.push({
        key: "filter",
        label: `Status: ${FILTER_LABELS[filter]}`,
        onRemove: () => setFilter("active"),
      })
    }
    if (sort !== "recent") {
      badges.push({
        key: "sort",
        label: `Sort: ${SORT_LABELS[sort]}`,
        onRemove: () => setSort("recent"),
      })
    }
    return badges
  }, [filter, queryParam, searchParams, setSearchParams, sort])

  const stuck = useStuckLoading(loading)

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Projects" breadcrumbs={[{ label: "Projects" }]} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-[108px] rounded-lg" />
          ))}
        </div>
        {stuck && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              This is taking longer than expected…
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        {error.isMissingIndex ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">
              {error.message}
            </p>
            {import.meta.env.DEV && error.indexUrl && (
              <a
                href={error.indexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-subtle)] underline"
              >
                Create index in Firebase Console
              </a>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--color-error)]">{error.message}</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Projects"
        breadcrumbs={[{ label: "Projects" }]}
        actions={
          showCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          ) : undefined
        }
      />

      {baseProjects.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[320px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <Input
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Search projects…"
                className="pl-9"
              />
            </div>

            <Select value={sort} onValueChange={(v) => setSort(v as ProjectSort)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as ProjectSort[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  {FILTER_LABELS[filter]}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {(Object.keys(FILTER_LABELS) as ProjectFilter[]).map((key) => (
                  <DropdownMenuItem key={key} onSelect={() => setFilter(key)}>
                    {FILTER_LABELS[key]}
                  </DropdownMenuItem>
                ))}
                {activeBadges.length > 0 && (
                  <DropdownMenuItem onSelect={clearFilters}>
                    Clear filters
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {activeBadges.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {activeBadges.map((b) => (
                <Badge
                  key={b.key}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={b.onRemove}
                  title="Click to remove"
                >
                  {b.label} &times;
                </Badge>
              ))}
            </div>
          )}

          {!canManage && (
            <div className="mb-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-text-muted)]">
              You have read-only access to projects. Contact an admin if you need to create or edit campaigns.
            </div>
          )}
        </>
      )}

      {baseProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-12 w-12" />}
          title="No projects yet"
          description="Create your first project to start planning shots."
          actionLabel={showCreate ? "Create Project" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : displayProjects.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="h-12 w-12" />}
          title="No matching projects"
          description="Try adjusting your search, filters, or sort."
          actionLabel={activeBadges.length > 0 ? "Clear filters" : undefined}
          onAction={activeBadges.length > 0 ? clearFilters : undefined}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              showActions={showActions}
              onEdit={(p) => setEditingProjectId(p.id)}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateProjectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
        />
      )}

      <EditProjectDialog
        open={!!editingProject}
        onOpenChange={(open) => {
          if (!open) setEditingProjectId(null)
        }}
        project={editingProject}
      />
    </ErrorBoundary>
  )
}
