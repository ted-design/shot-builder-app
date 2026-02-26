import { useMemo, useState } from "react"
import type { Timestamp } from "firebase/firestore"
import { ChevronDown, History } from "lucide-react"
import { toast } from "sonner"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { useAuth } from "@/app/providers/AuthProvider"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useShotVersions } from "@/features/shots/hooks/useShotVersions"
import { restoreShotVersion } from "@/features/shots/lib/shotVersioning"
import { Button } from "@/ui/button"
import type { Shot, ShotVersion } from "@/shared/types"

function formatDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(ts.toDate())
  } catch {
    return "—"
  }
}

function changeTypeLabel(type: ShotVersion["changeType"]): string {
  if (type === "create") return "Created"
  if (type === "rollback") return "Restored"
  return "Updated"
}

export function ShotVersionHistorySection({ shot }: { readonly shot: Shot }) {
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<ShotVersion | null>(null)
  const [restoring, setRestoring] = useState(false)

  const canRestore = useMemo(() => {
    if (isMobile) return false
    return role === "admin" || role === "producer"
  }, [isMobile, role])

  const {
    data: versions,
    loading,
    error,
  } = useShotVersions(open ? shot.id : null, 25)

  const visibleFields = useMemo(() => {
    const fields = restoreTarget?.changedFields ?? []
    const shown = fields.slice(0, 5)
    const remaining = fields.length - shown.length
    return { shown, remaining: remaining > 0 ? remaining : 0 }
  }, [restoreTarget?.changedFields])

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex min-w-0 items-center gap-2">
          <History className="h-4 w-4 text-[var(--color-text-muted)]" />
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--color-text)]">
              History
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Restore previous versions of this shot.
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-[var(--color-border)] p-4">
          {!canRestore && (
            <div className="mb-3 text-xs text-[var(--color-text-subtle)]">
              Restore is producer/admin desktop-only.
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
              {error.message}
            </div>
          )}

          {loading && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-muted)]">
              Loading history…
            </div>
          )}

          {!loading && versions.length === 0 && (
            <InlineEmpty
              icon={<History className="h-8 w-8" />}
              title="No history yet"
            />
          )}

          <div className="flex flex-col gap-2">
            {versions.map((v) => {
              const who = v.createdByName ?? "Unknown"
              const when = formatDateTime(v.createdAt)
              const fields = v.changedFields ?? []
              const summary =
                fields.length === 0
                  ? changeTypeLabel(v.changeType)
                  : `${changeTypeLabel(v.changeType)} · ${fields.slice(0, 3).join(", ")}${
                      fields.length > 3 ? ` +${fields.length - 3}` : ""
                    }`

              return (
                <div
                  key={v.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text)]">
                      {summary}
                    </div>
                    <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {when} · {who}
                    </div>
                  </div>
                  {canRestore && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8"
                      disabled={restoring}
                      onClick={() => setRestoreTarget(v)}
                    >
                      Restore
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(next) => {
          if (!next) setRestoreTarget(null)
        }}
        title="Restore this shot?"
        description="This will overwrite newer changes by restoring the shot fields to this saved version."
        confirmLabel={restoring ? "Restoring…" : "Restore"}
        destructive
        onConfirm={() => {
          if (!restoreTarget || !clientId || !user?.uid) return
          setRestoring(true)
          void restoreShotVersion({
            clientId,
            shotId: shot.id,
            version: restoreTarget,
            currentShot: shot,
            user,
          })
            .then(() => {
              toast.success("Shot restored")
            })
            .catch((err) => {
              toast.error(err instanceof Error ? err.message : "Failed to restore shot.")
            })
            .finally(() => {
              setRestoring(false)
              setRestoreTarget(null)
            })
        }}
      />

      {restoreTarget && (
        <div className="sr-only">
          Restoring version from {formatDateTime(restoreTarget.createdAt)} by{" "}
          {restoreTarget.createdByName ?? "Unknown"}.
          {visibleFields.shown.length > 0 && (
            <>
              Changed fields: {visibleFields.shown.join(", ")}
              {visibleFields.remaining ? ` and ${visibleFields.remaining} more.` : "."}
            </>
          )}
        </div>
      )}
    </div>
  )
}
