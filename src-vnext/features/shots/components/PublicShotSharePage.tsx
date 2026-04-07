import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Search, Settings2 } from "lucide-react"
import { TagBadge } from "@/shared/components/TagBadge"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { mergeShareColumnConfig, PUBLIC_SHARE_COLUMNS } from "@/features/shots/lib/shotTableColumns"
import type { ShareColumnEntry } from "@/features/shots/lib/shotTableColumns"
import type { TableColumnConfig } from "@/shared/types/table"
import type { ResolvedPublicShot } from "@/features/shots/lib/resolveShotsForShare"
import type { ShotTagCategory, ShotFirestoreStatus } from "@/shared/types"
import { getShotStatusLabel } from "@/shared/lib/statusMappings"

type ErrorInfo = {
  readonly heading: string
  readonly message: string
}

function formatDate(iso: string | null): string {
  if (!iso) return "\u2014"
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return "\u2014"
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(d)
  } catch {
    return "\u2014"
  }
}

function renderTags(s: ResolvedPublicShot): React.ReactNode {
  const tags = s.tags
  if (!tags || tags.length === 0) return "\u2014"
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <TagBadge
          key={t.id}
          tag={{ ...t, category: t.category as ShotTagCategory | undefined }}
        />
      ))}
    </div>
  )
}

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

function renderLinks(s: ResolvedPublicShot): React.ReactNode {
  const links = s.referenceLinks
  if (!links || links.length === 0) return "\u2014"
  const safe = links.filter((l) => isSafeUrl(l.url))
  if (safe.length === 0) return "\u2014"
  return (
    <div className="flex flex-col gap-0.5">
      {safe.map((l) => (
        <a
          key={l.id || l.url}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-xs text-[var(--color-text-secondary)] hover:underline"
        >
          {l.title || l.url}
        </a>
      ))}
    </div>
  )
}

function renderCell(s: ResolvedPublicShot, key: string): React.ReactNode {
  switch (key) {
    case "shot":
      return (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-medium text-[var(--color-text)]">{s.title}</span>
            {s.shotNumber && (
              <span className="text-xs text-[var(--color-text-subtle)]">#{s.shotNumber}</span>
            )}
          </div>
          {s.notesAddendum && (
            <div className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--color-surface-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
              {s.notesAddendum}
            </div>
          )}
        </div>
      )
    case "description":
      return s.description || "\u2014"
    case "date":
      return formatDate(s.date)
    case "location":
      return s.locationName || "\u2014"
    case "talent":
      return s.talentNames.length === 0 ? (
        "\u2014"
      ) : (
        <div className="flex flex-col gap-0.5">
          {s.talentNames.map((name) => (
            <div key={name} className="truncate">
              {name}
            </div>
          ))}
        </div>
      )
    case "products":
      return s.productLines.length === 0 ? (
        "\u2014"
      ) : (
        <div className="flex flex-col gap-0.5">
          {s.productLines.map((line, index) => (
            <div key={`${line}-${index}`} className="truncate">
              {line}
            </div>
          ))}
        </div>
      )
    case "tags":
      return renderTags(s)
    case "notes":
      return s.notesAddendum || "\u2014"
    case "links":
      return renderLinks(s)
    case "status":
      return getShotStatusLabel(s.status as ShotFirestoreStatus)
    default:
      return "\u2014"
  }
}

export default function PublicShotSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [shots, setShots] = useState<readonly ResolvedPublicShot[]>([])
  const [shareTitle, setShareTitle] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>("Project")
  const [scope, setScope] = useState<"project" | "selected">("project")
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [query, setQuery] = useState("")

  const [columnOverrides, setColumnOverrides] = useState<Record<string, boolean>>({})
  const [baseColumns, setBaseColumns] = useState<readonly TableColumnConfig[]>(PUBLIC_SHARE_COLUMNS)

  const [orderOverrides, setOrderOverrides] = useState<Record<string, number>>({})
  const [overridesLoaded, setOverridesLoaded] = useState(false)

  // Load viewer column overrides from localStorage (per share token)
  useEffect(() => {
    if (!shareToken) return
    try {
      const stored = localStorage.getItem(`sb:share-cols:${shareToken}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Support both legacy (Record<string, boolean>) and new format ({vis, order})
        if (parsed && typeof parsed === "object" && parsed.vis) {
          setColumnOverrides(parsed.vis as Record<string, boolean>)
          if (parsed.order) setOrderOverrides(parsed.order as Record<string, number>)
        } else {
          setColumnOverrides(parsed as Record<string, boolean>)
        }
      }
    } catch {
      // Ignore malformed storage
    }
    setOverridesLoaded(true)
  }, [shareToken])

  // Persist viewer column overrides to localStorage (skip until initial load completes)
  useEffect(() => {
    if (!shareToken || !overridesLoaded) return
    const hasVis = Object.keys(columnOverrides).length > 0
    const hasOrder = Object.keys(orderOverrides).length > 0
    if (!hasVis && !hasOrder) {
      localStorage.removeItem(`sb:share-cols:${shareToken}`)
    } else {
      localStorage.setItem(`sb:share-cols:${shareToken}`, JSON.stringify({
        vis: columnOverrides,
        order: orderOverrides,
      }))
    }
  }, [shareToken, columnOverrides, orderOverrides, overridesLoaded])

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!shareToken || shareToken.length < 10) {
        setErrorInfo({ heading: "Invalid link", message: "No share token provided." })
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorInfo(null)

      try {
        const shareRef = doc(db, "shotShares", shareToken)
        const snap = await getDoc(shareRef)

        if (!active) return

        if (!snap.exists()) {
          setErrorInfo({ heading: "Link not found", message: "This share link does not exist. It may have been deleted." })
          setLoading(false)
          return
        }

        const data = snap.data() as Record<string, unknown>

        if (data.enabled !== true) {
          setErrorInfo({ heading: "Sharing disabled", message: "Sharing has been disabled for these shots." })
          setLoading(false)
          return
        }

        // Check expiration client-side
        if (data.expiresAt) {
          try {
            const expiresAt = (data.expiresAt as { toDate: () => Date }).toDate()
            if (expiresAt.getTime() < Date.now()) {
              setErrorInfo({ heading: "Link expired", message: "This share link has expired. Ask the sender for a new one." })
              setLoading(false)
              return
            }
          } catch {
            // Ignore malformed expiresAt
          }
        }

        const resolved = Array.isArray(data.resolvedShots) ? (data.resolvedShots as ResolvedPublicShot[]) : []
        const name = typeof data.projectName === "string" ? data.projectName : "Project"
        const title = typeof data.title === "string" ? data.title : null
        const hasShotIds = Array.isArray(data.shotIds) && data.shotIds.length > 0

        const rawColumnConfig = Array.isArray(data.columnConfig)
          ? (data.columnConfig as ShareColumnEntry[])
          : null
        setBaseColumns(mergeShareColumnConfig(rawColumnConfig))

        setShots(resolved)
        setProjectName(name)
        setShareTitle(title)
        setScope(hasShotIds ? "selected" : "project")
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error("[PublicShotSharePage] Failed to load share:", err)
        setErrorInfo({ heading: "Failed to load", message: "Something went wrong. Please check the link and try again." })
        setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [shareToken])

  const effectiveColumns = useMemo(() => {
    return baseColumns.map((col) => {
      const visOverride = columnOverrides[col.key]
      const orderOverride = orderOverrides[col.key]
      if (visOverride === undefined && orderOverride === undefined) return col
      return {
        ...col,
        visible: visOverride !== undefined ? visOverride : col.visible,
        order: orderOverride !== undefined ? orderOverride : col.order,
      }
    })
  }, [baseColumns, columnOverrides, orderOverrides])

  const visibleColumns = useMemo(() => {
    return [...effectiveColumns].filter((c) => c.visible).sort((a, b) => a.order - b.order)
  }, [effectiveColumns])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return shots
    return shots.filter((s) => {
      const tagLabels = (s.tags ?? []).map((t) => t.label).join(" ")
      const haystack = [
        s.title,
        s.shotNumber ?? "",
        getShotStatusLabel(s.status as ShotFirestoreStatus),
        s.locationName ?? "",
        (s.talentNames ?? []).join(" "),
        (s.productLines ?? []).join(" "),
        s.description ?? "",
        s.notesAddendum ?? "",
        tagLabels,
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, shots])

  const handleToggleColumn = (key: string) => {
    const col = effectiveColumns.find((c) => c.key === key)
    if (!col || col.pinned) return
    setColumnOverrides((prev) => ({ ...prev, [key]: !col.visible }))
  }

  const handleReorderColumns = (orderedKeys: readonly string[]) => {
    const newOrder: Record<string, number> = {}
    for (let i = 0; i < orderedKeys.length; i++) {
      newOrder[orderedKeys[i]!] = i
    }
    setOrderOverrides(newOrder)
  }

  const handleResetColumns = () => {
    setColumnOverrides({})
    setOrderOverrides({})
  }

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />

  if (errorInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="heading-subsection">{errorInfo.heading}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{errorInfo.message}</p>
        </div>
      </div>
    )
  }

  const title = shareTitle || projectName
  const subLabel = scope === "selected" ? "Shared selection" : "Shared project shots"

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                  Shared view
                </span>
                <span className="text-xs text-[var(--color-text-muted)]">{subLabel}</span>
              </div>
              <div className="flex items-center gap-2">
                <ColumnSettingsPopover
                  columns={effectiveColumns}
                  onToggleVisibility={handleToggleColumn}
                  onReorder={handleReorderColumns}
                  onReset={handleResetColumns}
                  showReorder={true}
                >
                  <Button variant="outline" size="sm">
                    <Settings2 className="mr-1.5 h-3.5 w-3.5" />
                    Columns
                  </Button>
                </ColumnSettingsPopover>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </div>
            <h1 className="heading-page">{title}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {projectName} · {filtered.length} shots
            </p>
          </div>

          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={"Search shots\u2026"}
              className="pl-9 text-sm"
            />
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">No shots</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-[var(--color-text-muted)]">
                No shots match your search.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
                  <tr>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.key}
                        className="px-3 py-2 text-left font-medium"
                        style={{ minWidth: col.width }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--color-border)]">
                      {visibleColumns.map((col) => (
                        <td key={col.key} className="px-3 py-2 text-[var(--color-text-secondary)]">
                          {renderCell(s, col.key)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
