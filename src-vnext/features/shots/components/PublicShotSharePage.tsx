import { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { LoadingState } from "@/shared/components/LoadingState"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"

type PublicShot = {
  readonly id: string
  readonly title: string
  readonly shotNumber: string | null
  readonly status: string
  readonly date: string | null
  readonly locationName: string | null
  readonly talentNames: readonly string[]
  readonly productLines: readonly string[]
  readonly description: string | null
  readonly notesAddendum: string | null
}

type ResolveShotShareResult = {
  readonly share: {
    readonly id: string
    readonly title: string | null
    readonly expiresAt: string | null
    readonly scope: "project" | "selected"
  }
  readonly project: { readonly id: string; readonly name: string }
  readonly shots: readonly PublicShot[]
}

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

function errorFromStatus(status: number, serverMessage: string | null): ErrorInfo {
  switch (status) {
    case 400:
      return { heading: "Invalid link", message: "The share token is invalid. Please check the link and try again." }
    case 403:
      return { heading: "Sharing disabled", message: "Sharing has been disabled for these shots." }
    case 404:
      return { heading: "Link not found", message: "This share link does not exist. It may have been deleted." }
    case 410:
      return { heading: "Link expired", message: "This share link has expired. Ask the sender for a new one." }
    default:
      return {
        heading: "Failed to load",
        message: serverMessage || "Something went wrong. Please try again later.",
      }
  }
}

export default function PublicShotSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [result, setResult] = useState<ResolveShotShareResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [query, setQuery] = useState("")

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!shareToken) {
        setErrorInfo({ heading: "Invalid link", message: "No share token provided." })
        setLoading(false)
        return
      }

      setLoading(true)
      setErrorInfo(null)

      try {
        const response = await fetch("/api/resolveShotShareToken", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shareToken }),
        })

        if (!active) return

        if (!response.ok) {
          let serverMessage: string | null = null
          try {
            const body = await response.json()
            serverMessage = body.error ?? null
          } catch {
            // Ignore parse errors
          }
          setErrorInfo(errorFromStatus(response.status, serverMessage))
          setResult(null)
          setLoading(false)
          return
        }

        const data = (await response.json()) as ResolveShotShareResult | null
        if (!active) return
        if (!data || !data.project || !Array.isArray(data.shots)) {
          setErrorInfo({ heading: "Failed to load", message: "Invalid response. Please check the link and try again." })
          setResult(null)
          setLoading(false)
          return
        }
        setResult(data)
        setLoading(false)
      } catch {
        if (!active) return
        setErrorInfo({ heading: "Failed to load", message: "Network error. Please check your connection and try again." })
        setResult(null)
        setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [shareToken])

  const shots = useMemo(() => {
    const list = result?.shots ?? []
    const q = query.trim().toLowerCase()
    if (!q) return list
    return list.filter((s) => {
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
  }, [query, result?.shots])

  if (loading) return <LoadingState loading />

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

  if (!result) return null

  const title = result.share.title || result.project.name
  const subLabel =
    result.share.scope === "selected" ? "Shared selection" : "Shared project shots"

  return (
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
          <h1 className="text-2xl font-semibold text-[var(--color-text)]">{title}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {result.project.name} · {shots.length} shots
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

        {shots.length === 0 ? (
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
                {shots.map((s) => (
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
  )
}
