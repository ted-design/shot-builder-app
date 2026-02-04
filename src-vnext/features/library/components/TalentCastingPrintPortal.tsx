import { createPortal } from "react-dom"
import { useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { resolveStoragePath } from "@/shared/lib/resolveStoragePath"
import type { TalentRecord } from "@/shared/types"

type CastingSession = NonNullable<TalentRecord["castingSessions"]>[number]

function displayName(talent: TalentRecord): string {
  const name = talent.name?.trim()
  if (name) return name
  const first = (talent.firstName ?? "").trim()
  const last = (talent.lastName ?? "").trim()
  const combined = `${first} ${last}`.trim()
  return combined || "Unnamed talent"
}

function formatDecision(value: string | null | undefined): string | null {
  const v = value?.trim()
  if (!v) return null
  if (v === "pending") return "Pending"
  if (v === "shortlist") return "Shortlist"
  if (v === "hold") return "Hold"
  if (v === "pass") return "Pass"
  if (v === "booked") return "Booked"
  return v
}

function MetaRow({ label, value }: { readonly label: string; readonly value: string | null }) {
  if (!value) return null
  return (
    <div className="flex gap-2 text-sm">
      <div className="w-28 shrink-0 text-[var(--color-text-muted)]">{label}</div>
      <div className="min-w-0 flex-1 text-[var(--color-text)]">{value}</div>
    </div>
  )
}

function PrintDoc({
  talent,
  session,
  projectName,
  srcByKey,
  onImageEvent,
}: {
  readonly talent: TalentRecord
  readonly session: CastingSession
  readonly projectName: string | null
  readonly srcByKey: Record<string, string>
  readonly onImageEvent: (key: string) => void
}) {
  const headshotKey = "headshot"
  const headshotSrc = srcByKey[headshotKey] ?? null

  return (
    <div data-talent-casting-print-root className="min-h-screen bg-white">
      <div className="mx-auto w-full max-w-5xl p-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
              Casting Contact Sheet
            </div>
            <div className="mt-1 text-3xl font-semibold text-[var(--color-text)]">
              {displayName(talent)}
            </div>
            <div className="mt-2 flex flex-col gap-1">
              <MetaRow label="Agency" value={(talent.agency ?? "").trim() || null} />
              <MetaRow label="Email" value={(talent.email ?? "").trim() || null} />
              <MetaRow label="Phone" value={(talent.phone ?? "").trim() || null} />
              <MetaRow label="URL" value={(talent.url ?? "").trim() || null} />
            </div>
          </div>

          <div className="w-28 shrink-0">
            {headshotSrc ? (
              <img
                src={headshotSrc}
                alt={`${displayName(talent)} headshot`}
                onLoad={() => onImageEvent(headshotKey)}
                onError={() => onImageEvent(headshotKey)}
                className="h-28 w-28 rounded-md border border-[var(--color-border)] object-cover"
              />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text-muted)]">
                —
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-md border border-[var(--color-border)] p-4">
          <div className="flex flex-col gap-1">
            <div className="text-lg font-semibold text-[var(--color-text)]">
              {session.title?.trim() ? session.title.trim() : "Casting"}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">{session.date}</div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <MetaRow label="Project" value={projectName} />
            <MetaRow label="Location" value={session.location?.trim() || null} />
            <MetaRow label="Decision" value={formatDecision(session.decision)} />
            <MetaRow label="Rating" value={session.rating ? String(session.rating) : null} />
          </div>

          {session.brief?.trim() ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                Role / Brief
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text)]">
                {session.brief.trim()}
              </div>
            </div>
          ) : null}

          {session.notes?.trim() ? (
            <div className="mt-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                Notes
              </div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text)]">
                {session.notes.trim()}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
            Images
          </div>

          {(session.images ?? []).length === 0 ? (
            <div className="mt-3 text-sm text-[var(--color-text-muted)]">No images.</div>
          ) : (
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {(session.images ?? []).map((img) => {
                const key = `img:${img.id}`
                const src = srcByKey[key] ?? null
                return (
                  <div key={img.id} className="break-inside-avoid">
                    {src ? (
                      <img
                        src={src}
                        alt="Casting image"
                        onLoad={() => onImageEvent(key)}
                        onError={() => onImageEvent(key)}
                        className="aspect-square w-full rounded-md border border-[var(--color-border)] object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-xs text-[var(--color-text-muted)]">
                        —
                      </div>
                    )}
                    {img.description?.trim() ? (
                      <div className="mt-2 whitespace-pre-wrap text-xs text-[var(--color-text-muted)]">
                        {img.description.trim()}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function TalentCastingPrintPortal({
  open,
  onOpenChange,
  talent,
  session,
  projectName = null,
  timeoutMs = 10_000,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly talent: TalentRecord
  readonly session: CastingSession
  readonly projectName?: string | null
  readonly timeoutMs?: number
}) {
  const [container] = useState(() => {
    const el = document.createElement("div")
    el.setAttribute("data-talent-casting-print-portal", "1")
    el.style.position = "fixed"
    el.style.inset = "0"
    el.style.background = "white"
    el.style.zIndex = "9999"
    el.style.overflow = "auto"
    return el
  })

  const [srcByKey, setSrcByKey] = useState<Record<string, string>>({})
  const [resolved, setResolved] = useState(false)
  const [loadedKeys, setLoadedKeys] = useState<ReadonlySet<string>>(() => new Set())

  const expectedKeys = useMemo(() => {
    const keys: string[] = []
    if (srcByKey["headshot"]) keys.push("headshot")
    for (const img of session.images ?? []) {
      const key = `img:${img.id}`
      if (srcByKey[key]) keys.push(key)
    }
    return keys
  }, [session.images, srcByKey])

  const allReady = resolved && expectedKeys.every((k) => loadedKeys.has(k))
  const fired = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    document.body.appendChild(container)
    document.body.setAttribute("data-talent-casting-printing", "1")

    const handleAfterPrint = () => onOpenChange(false)
    window.addEventListener("afterprint", handleAfterPrint)

    const timeout = window.setTimeout(() => {
      toast.error("Export failed: images did not load in time.")
      onOpenChange(false)
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("afterprint", handleAfterPrint)
      document.body.removeAttribute("data-talent-casting-printing")
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
        closeTimerRef.current = null
      }
      try {
        container.remove()
      } catch {
        // ignore
      }
      fired.current = false
      setSrcByKey({})
      setResolved(false)
      setLoadedKeys(new Set())
    }
  }, [open, container, onOpenChange, timeoutMs])

  useEffect(() => {
    if (!open) return
    setResolved(false)
    setLoadedKeys(new Set())

    const headshotPath =
      (talent.headshotPath && talent.headshotPath.trim().length > 0 ? talent.headshotPath.trim() : null) ||
      (talent.imageUrl && talent.imageUrl.trim().length > 0 ? talent.imageUrl.trim() : null)

    const assets: Array<{ key: string; source: string }> = []
    if (headshotPath) assets.push({ key: "headshot", source: headshotPath })

    for (const img of session.images ?? []) {
      const source = (img.downloadURL ?? "").trim() || (img.path ?? "").trim()
      if (!source) continue
      assets.push({ key: `img:${img.id}`, source })
    }

    let cancelled = false
    Promise.allSettled(
      assets.map(async (asset) => {
        const resolvedSrc = await resolveStoragePath(asset.source)
        return { key: asset.key, src: resolvedSrc }
      }),
    ).then((results) => {
      if (cancelled) return
      const next: Record<string, string> = {}
      for (const res of results) {
        if (res.status !== "fulfilled") continue
        next[res.value.key] = res.value.src
      }
      setSrcByKey(next)
      setResolved(true)
    })

    return () => {
      cancelled = true
    }
  }, [open, session, talent])

  useEffect(() => {
    if (!open) return
    if (fired.current) return
    if (!allReady) return
    fired.current = true
    try {
      window.print()
      closeTimerRef.current = window.setTimeout(() => onOpenChange(false), 250)
    } catch {
      toast.error("Export failed to start printing.")
      onOpenChange(false)
    }
  }, [allReady, onOpenChange, open])

  const onImageEvent = (key: string) => {
    setLoadedKeys((prev) => {
      if (prev.has(key)) return prev
      const next = new Set(prev)
      next.add(key)
      return next
    })
  }

  if (!open) return null

  return createPortal(
    resolved ? (
      <PrintDoc
        talent={talent}
        session={session}
        projectName={projectName}
        srcByKey={srcByKey}
        onImageEvent={onImageEvent}
      />
    ) : (
      <div className="flex min-h-screen items-center justify-center bg-white p-8">
        <div className="text-sm text-[var(--color-text-muted)]">Preparing export…</div>
      </div>
    ),
    container,
  )
}
