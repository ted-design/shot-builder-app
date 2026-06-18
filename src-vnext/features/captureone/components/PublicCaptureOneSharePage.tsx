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
import { AlertTriangle, Copy, Download, Search } from "lucide-react"
import { toast } from "sonner"
import {
  buildCaptureOneXlsxBuffer,
  captureOneXlsxFilename,
} from "@/features/captureone/lib/exportCaptureOneXlsx"

interface PublicHeroFilename {
  readonly name: string
  readonly genderResolved: boolean
}

interface PublicCaptureOneShot {
  readonly id: string
  readonly shotNumber: string | null
  readonly title: string
  readonly filenames: readonly PublicHeroFilename[]
}

type ErrorInfo = { readonly heading: string; readonly message: string }

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement("textarea")
      el.value = text
      el.style.position = "fixed"
      el.style.left = "-9999px"
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand("copy")
      el.remove()
      return ok
    } catch {
      return false
    }
  }
}

async function copyWithToast(text: string, label: string): Promise<void> {
  const ok = await copyToClipboard(text)
  if (ok) toast.success(label)
  else toast.error("Couldn’t copy — copy manually")
}

function FilenameChip({ file }: { readonly file: PublicHeroFilename }) {
  return (
    <button
      type="button"
      onClick={() => void copyWithToast(file.name, "Filename copied")}
      title={
        file.genderResolved
          ? "Copy filename"
          : "Gender unresolved — set the product’s gender so the prefix isn’t a placeholder U_"
      }
      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-1 font-mono text-xs text-[var(--color-text)] hover:bg-[var(--color-surface)]"
    >
      {!file.genderResolved && (
        <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" aria-label="Gender unresolved" />
      )}
      <span className="truncate">{file.name}</span>
      <Copy className="h-3 w-3 shrink-0 text-[var(--color-text-subtle)]" />
    </button>
  )
}

export default function PublicCaptureOneSharePage() {
  const { shareToken } = useParams<{ shareToken: string }>()
  const [shots, setShots] = useState<readonly PublicCaptureOneShot[]>([])
  const [shareTitle, setShareTitle] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string>("Project")
  const [loading, setLoading] = useState(true)
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null)
  const [query, setQuery] = useState("")
  const [downloading, setDownloading] = useState(false)

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
        const snap = await getDoc(doc(db, "captureOneShares", shareToken))
        if (!active) return
        if (!snap.exists()) {
          setErrorInfo({ heading: "Link not found", message: "This share link does not exist. It may have been deleted." })
          setLoading(false)
          return
        }
        const data = snap.data() as Record<string, unknown>
        if (data.enabled !== true) {
          setErrorInfo({ heading: "Sharing disabled", message: "Sharing has been disabled for this link." })
          setLoading(false)
          return
        }
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
        // Treat the denormalized payload as untrusted — coerce filenames to an array.
        const resolved = Array.isArray(data.shots)
          ? (data.shots as PublicCaptureOneShot[]).map((s) => ({
              ...s,
              filenames: Array.isArray(s?.filenames) ? s.filenames : [],
            }))
          : []
        setShots(resolved)
        setProjectName(typeof data.projectName === "string" ? data.projectName : "Project")
        setShareTitle(typeof data.title === "string" ? data.title : null)
        setLoading(false)
      } catch (err) {
        if (!active) return
        console.error("[PublicCaptureOneSharePage] Failed to load share:", err)
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
      const haystack = [s.title, s.shotNumber ?? "", ...s.filenames.map((f) => f.name)]
        .join(" ")
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [query, shots])

  const allNames = useMemo(
    () => filtered.flatMap((s) => s.filenames.map((f) => f.name)),
    [filtered],
  )
  const unresolvedCount = useMemo(
    () => filtered.reduce((n, s) => n + s.filenames.filter((f) => !f.genderResolved).length, 0),
    [filtered],
  )

  // Exports the full snapshot (all shots), not the search-filtered view.
  const downloadXlsx = async () => {
    if (shots.length === 0) return
    setDownloading(true)
    try {
      const buffer = await buildCaptureOneXlsxBuffer({ projectName, shots })
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const filename = captureOneXlsxFilename(projectName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      console.error("[PublicCaptureOneSharePage] xlsx export failed:", err)
      toast.error("Couldn’t generate the .xlsx")
    } finally {
      setDownloading(false)
    }
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

  const title = shareTitle || `${projectName} — Capture One names`

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">
                Capture One · digi-tech
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={allNames.length === 0}
                  onClick={() => void copyWithToast(allNames.join("\n"), `Copied ${allNames.length} filenames`)}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy all
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={shots.length === 0 || downloading}
                  onClick={() => void downloadXlsx()}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {downloading ? "Preparing…" : "Download .xlsx"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()}>
                  Print
                </Button>
              </div>
            </div>
            <h1 className="heading-page">{title}</h1>
            <p className="text-sm text-[var(--color-text-muted)]">
              {projectName} · {filtered.length} shots · {allNames.length} filenames
            </p>
            {unresolvedCount > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {unresolvedCount} filename{unresolvedCount === 1 ? "" : "s"} use a placeholder
                {" "}U_ prefix — set the product’s gender to resolve.
              </p>
            )}
          </div>

          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={"Search shots or filenames…"}
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
            <div className="flex flex-col gap-2">
              {filtered.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      {s.shotNumber && (
                        <span className="text-xs text-[var(--color-text-subtle)]">#{s.shotNumber}</span>
                      )}
                      <span className="font-medium text-[var(--color-text)]">{s.title}</span>
                    </div>
                    {s.filenames.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          void copyWithToast(
                            s.filenames.map((f) => f.name).join("\n"),
                            `Copied ${s.filenames.length} filenames`,
                          )
                        }
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copy shot
                      </Button>
                    )}
                  </div>
                  {s.filenames.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--color-text-subtle)]">
                      No hero products starred for this shot.
                    </p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {s.filenames.map((file, index) => (
                        <FilenameChip key={`${file.name}-${index}`} file={file} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  )
}
