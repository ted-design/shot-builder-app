import { useMemo, useState } from "react"
import type { Timestamp } from "firebase/firestore"
import { ChevronDown, History } from "lucide-react"
import { toast } from "sonner"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { useAuth } from "@/app/providers/AuthProvider"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useProductVersions } from "@/features/products/hooks/useProductVersions"
import { useProductSkus } from "@/features/products/hooks/useProducts"
import { restoreProductVersion } from "@/features/products/lib/productVersioning"
import { formatLaunchDate } from "@/features/products/lib/assetRequirements"
import { Button } from "@/ui/button"
import type { ProductFamily, ProductVersion, ProductVersionFieldChange } from "@/shared/types"

function formatDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "\u2014"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(ts.toDate())
  } catch {
    return "\u2014"
  }
}

function changeTypeLabel(type: ProductVersion["changeType"]): string {
  if (type === "create") return "Created"
  if (type === "rollback") return "Restored"
  return "Updated"
}

function formatFieldValue(field: string, value: unknown): string {
  if (value === null || value === undefined) return "\u2014"
  if (field === "launchDate" || field.endsWith(": Launch Date")) {
    if (typeof value === "object" && value !== null && "toDate" in value) {
      return formatLaunchDate(value as Timestamp)
    }
    if (typeof value === "object" && value !== null && "seconds" in value) {
      try {
        const ts = value as { seconds: number }
        return new Date(ts.seconds * 1000).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      } catch {
        return String(value)
      }
    }
    return String(value)
  }
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "\u2014"
  if (typeof value === "object" && value !== null) {
    if ("toDate" in value) {
      try {
        return (value as Timestamp).toDate().toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      } catch {
        // fall through
      }
    }
    if ("seconds" in value) {
      try {
        return new Date((value as { seconds: number }).seconds * 1000).toLocaleDateString(
          "en-US",
          { year: "numeric", month: "short", day: "numeric" },
        )
      } catch {
        // fall through
      }
    }
    return JSON.stringify(value)
  }
  return String(value)
}

interface FieldChangeDisplayProps {
  readonly change: ProductVersionFieldChange
}

function FieldChangeDisplay({ change }: FieldChangeDisplayProps) {
  const prev = formatFieldValue(change.field, change.previousValue)
  const curr = formatFieldValue(change.field, change.currentValue)
  return (
    <div className="text-xs text-[var(--color-text-muted)]">
      <span className="font-medium text-[var(--color-text)]">{change.label}</span>
      {": "}
      <span className="line-through opacity-60">{prev}</span>
      {" \u2192 "}
      <span>{curr}</span>
    </div>
  )
}

export function ProductVersionHistorySection({
  family,
}: {
  readonly family: ProductFamily
}) {
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [restoreTarget, setRestoreTarget] = useState<ProductVersion | null>(null)
  const [restoring, setRestoring] = useState(false)

  const canRestore = useMemo(() => {
    if (isMobile) return false
    return role === "admin" || role === "producer"
  }, [isMobile, role])

  const {
    data: versions,
    loading,
    error,
  } = useProductVersions(open ? family.id : null, 25)

  const { data: skus } = useProductSkus(open ? family.id : null)

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
              Version History
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              Track changes and restore previous versions.
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
              {typeof error === "object" && error !== null && "message" in error
                ? (error as { message: string }).message
                : "Failed to load history."}
            </div>
          )}

          {loading && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-muted)]">
              Loading history\u2026
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
              const fieldChanges = v.fieldChanges ?? []
              const changedFields = v.changedFields ?? []

              const headerLabel = (() => {
                if (v.changeType === "create") return "Created"
                if (v.changeType === "rollback") return "Restored"
                if (v.targetSkuLabel) return `Updated ${v.targetSkuLabel}`
                if (fieldChanges.length > 0) {
                  return `Updated ${fieldChanges.length} field${fieldChanges.length === 1 ? "" : "s"}`
                }
                if (changedFields.length > 0) {
                  return `Updated ${changedFields.length} field${changedFields.length === 1 ? "" : "s"}`
                }
                return changeTypeLabel(v.changeType)
              })()

              const visibleChanges = fieldChanges.slice(0, 5)
              const remainingCount = fieldChanges.length - visibleChanges.length

              return (
                <div
                  key={v.id}
                  className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text)]">
                        {headerLabel}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                        {when} &middot; {who}
                      </div>
                    </div>
                    {canRestore && v.changeType !== "create" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        disabled={restoring}
                        onClick={() => setRestoreTarget(v)}
                      >
                        Restore
                      </Button>
                    )}
                  </div>
                  {visibleChanges.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 border-t border-[var(--color-border)] pt-2">
                      {visibleChanges.map((fc, i) => (
                        <FieldChangeDisplay key={`${fc.field}-${i}`} change={fc} />
                      ))}
                      {remainingCount > 0 && (
                        <div className="text-2xs text-[var(--color-text-subtle)]">
                          +{remainingCount} more change{remainingCount === 1 ? "" : "s"}
                        </div>
                      )}
                    </div>
                  )}
                  {visibleChanges.length === 0 && changedFields.length > 0 && (
                    <div className="mt-2 text-xs text-[var(--color-text-muted)]">
                      {changedFields.slice(0, 5).join(", ")}
                      {changedFields.length > 5
                        ? ` +${changedFields.length - 5} more`
                        : ""}
                    </div>
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
        title="Restore this version?"
        description="This will restore family-level fields (name, launch date, status, etc.) to this saved version. Per-colorway changes are not affected."
        confirmLabel={restoring ? "Restoring\u2026" : "Restore"}
        destructive
        onConfirm={() => {
          if (!restoreTarget || !clientId || !user?.uid) return
          setRestoring(true)
          void restoreProductVersion({
            clientId,
            familyId: family.id,
            version: restoreTarget,
            currentFamily: family,
            user,
            allSkus: skus.filter((s) => s.deleted !== true),
          })
            .then(() => {
              toast.success("Product restored")
            })
            .catch((err) => {
              toast.error(
                err instanceof Error ? err.message : "Failed to restore product.",
              )
            })
            .finally(() => {
              setRestoring(false)
              setRestoreTarget(null)
            })
        }}
      />
    </div>
  )
}
