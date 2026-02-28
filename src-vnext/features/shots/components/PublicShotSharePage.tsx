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
import type { ResolvedPublicShot } from "@/features/shots/lib/resolveShotsForShare"

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

export default function PublicShotSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [shots, setShots] = useState<readonly ResolvedPublicShot[]>([])
  const [shareTitle, setShareTitle] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>("Project")
  const [scope, setScope] = useState<"project" | "selected">("project")
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [query, setQuery] = useState("")

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return shots
    return shots.filter((s) => {
      const haystack = [
        s.title,
        s.shotNumber ?? "",
        s.status,
        s.locationName ?? "",
        (s.talentNames ?? []).join(" "),
        (s.productLines ?? []).join(" "),
        s.description ?? "",
        s.notesAddendum ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, shots])

  if (loading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />

  if (errorInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
        <div className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h1 className="text-base font-semibold text-[var(--color-text)]">{errorInfo.heading}</h1>
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
            <Button variant="outline" onClick={() => window.print()}>
              Print
            </Button>
          </div>
          <h1 className="heading-page">{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {projectName} · {filtered.length} shots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search shots\u2026"
            className="w-full sm:w-[320px]"
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
                  <th className="min-w-[240px] px-3 py-2 text-left font-medium">Shot</th>
                  <th className="w-28 px-3 py-2 text-left font-medium">Date</th>
                  <th className="min-w-[180px] px-3 py-2 text-left font-medium">Location</th>
                  <th className="min-w-[220px] px-3 py-2 text-left font-medium">Talent</th>
                  <th className="min-w-[320px] px-3 py-2 text-left font-medium">Products</th>
                  <th className="w-24 px-3 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--color-border)]">
                    <td className="px-3 py-2">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-[var(--color-text)]">
                          {s.title}
                        </span>
                        {s.shotNumber && (
                          <span className="text-xs text-[var(--color-text-subtle)]">
                            #{s.shotNumber}
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-[var(--color-text-muted)]">
                          {s.description}
                        </div>
                      )}
                      {s.notesAddendum && (
                        <div className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--color-surface-subtle)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                          {s.notesAddendum}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {formatDate(s.date)}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {s.locationName || "\u2014"}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {s.talentNames.length === 0 ? (
                        "\u2014"
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {s.talentNames.map((name) => (
                            <div key={name} className="truncate">
                              {name}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {s.productLines.length === 0 ? (
                        "\u2014"
                      ) : (
                        <div className="flex flex-col gap-0.5">
                          {s.productLines.map((line, index) => (
                            <div key={`${line}-${index}`} className="truncate">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[var(--color-text-secondary)]">
                      {s.status}
                    </td>
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
