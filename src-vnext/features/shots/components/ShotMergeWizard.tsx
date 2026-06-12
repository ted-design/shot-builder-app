import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { GitMerge, Image as ImageIcon, MapPin, Calendar } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { getShotStatusLabel } from "@/shared/lib/statusMappings"
import type { AuthUser, Shot } from "@/shared/types"
import {
  buildShotMergePlan,
  executeShotMerge,
  type ShotMergeMode,
  type ShotMergeResult,
} from "../lib/shotMergeWrites"

interface ShotMergeWizardProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly clientId: string | null
  readonly user: AuthUser | null
  /** The exactly-2 selected shots. */
  readonly shotA: Shot
  readonly shotB: Shot
  /** For the "View shot" nav. */
  readonly projectId: string
  /** Clear selection on success. */
  readonly onMerged?: () => void
}

type WizardStep = "compare" | "preview" | "result"

const STEPS: ReadonlyArray<{ readonly key: WizardStep; readonly label: string }> = [
  { key: "compare", label: "Compare" },
  { key: "preview", label: "Preview" },
  { key: "result", label: "Result" },
]

const MODE_OPTIONS: ReadonlyArray<{
  readonly key: ShotMergeMode
  readonly label: string
  readonly helper: string
}> = [
  {
    key: "combine",
    label: "Combine into one outfit look",
    helper: "Products from both shots merge into a single look (deduped).",
  },
  {
    key: "separate",
    label: "Keep as separate looks",
    helper: "Each shot's looks are preserved side by side as alternatives.",
  },
]

function StepIndicator({
  steps,
  current,
}: {
  readonly steps: ReadonlyArray<{ readonly key: WizardStep; readonly label: string }>
  readonly current: WizardStep
}) {
  const currentIndex = steps.findIndex((s) => s.key === current)

  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => {
        const isActive = s.key === current
        const isPast = i < currentIndex
        return (
          <div key={s.key} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-4",
                  isPast ? "bg-[var(--color-status-green-text)]" : "bg-[var(--color-border)]",
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-medium transition-colors",
                isActive
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-fg)]"
                  : isPast
                    ? "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]",
              )}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Distinct product count across a shot's looks (or root products fallback). */
function shotProductCount(shot: Shot): number {
  if (shot.looks?.length) {
    const seen = new Set<string>()
    for (const look of shot.looks) {
      for (const p of look.products ?? []) {
        seen.add(`${p.familyId}::${p.skuId ?? ""}::${p.colourId ?? ""}`)
      }
    }
    return seen.size
  }
  return shot.products?.length ?? 0
}

/** Number of looks (legacy root-products shot counts as one synthetic look). */
function shotLookCount(shot: Shot): number {
  if (shot.looks?.length) return shot.looks.length
  return shot.products?.length ? 1 : 0
}

function formatDate(shot: Shot): string | null {
  if (!shot.date) return null
  try {
    return shot.date.toDate().toLocaleDateString()
  } catch {
    return null
  }
}

function ShotCompareCard({
  shot,
  isPrimary,
}: {
  readonly shot: Shot
  readonly isPrimary: boolean
}) {
  const heroUrl = useStorageUrl(shot.heroImage?.path)
  const resolved = heroUrl ?? shot.heroImage?.downloadURL
  const date = formatDate(shot)

  return (
    <div
      className={cn(
        "flex-1 rounded-lg border p-3",
        isPrimary
          ? "border-[var(--color-primary)] bg-[var(--color-surface-subtle)]"
          : "border-[var(--color-border)]",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          {isPrimary ? "Primary (kept)" : "Secondary (merged in)"}
        </span>
      </div>
      <div className="mb-3 aspect-video w-full overflow-hidden rounded-md bg-[var(--color-surface-subtle)]">
        {resolved ? (
          <img
            src={resolved}
            alt={shot.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-text-subtle)]">
            <ImageIcon className="h-6 w-6" />
          </div>
        )}
      </div>
      <h3 className="heading-subsection mb-2 truncate" title={shot.title}>
        {shot.title}
      </h3>
      <dl className="space-y-1 text-xs text-[var(--color-text-muted)]">
        <div className="flex justify-between">
          <dt>Products</dt>
          <dd className="font-medium text-[var(--color-text)]">{shotProductCount(shot)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Looks</dt>
          <dd className="font-medium text-[var(--color-text)]">{shotLookCount(shot)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Talent</dt>
          <dd className="font-medium text-[var(--color-text)]">{shot.talent?.length ?? 0}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Status</dt>
          <dd className="font-medium text-[var(--color-text)]">{getShotStatusLabel(shot.status)}</dd>
        </div>
        {shot.locationName && (
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{shot.locationName}</span>
          </div>
        )}
        {date && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{date}</span>
          </div>
        )}
      </dl>
    </div>
  )
}

export function ShotMergeWizard({
  open,
  onOpenChange,
  clientId,
  user,
  shotA,
  shotB,
  projectId,
  onMerged,
}: ShotMergeWizardProps) {
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>("compare")
  // true → shotA is primary; false → shotB is primary.
  const [aIsPrimary, setAIsPrimary] = useState(true)
  const [mode, setMode] = useState<ShotMergeMode>("combine")
  const [confirmed, setConfirmed] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<ShotMergeResult | null>(null)

  // Reset state when dialog closes.
  useEffect(() => {
    if (!open) {
      setStep("compare")
      setAIsPrimary(true)
      setMode("combine")
      setConfirmed(false)
      setMerging(false)
      setMergeResult(null)
    }
  }, [open])

  const primary = aIsPrimary ? shotA : shotB
  const secondary = aIsPrimary ? shotB : shotA

  const preview = useMemo(() => {
    if (step !== "preview") return null
    return buildShotMergePlan({ primary, secondary, mode })
  }, [step, primary, secondary, mode])

  const handleSwap = useCallback(() => {
    setAIsPrimary((prev) => !prev)
  }, [])

  const handleToPreview = useCallback(() => {
    setConfirmed(false)
    setStep("preview")
  }, [])

  const handleBackToCompare = useCallback(() => {
    setStep("compare")
  }, [])

  const handleMerge = useCallback(async () => {
    if (!clientId) {
      toast.error("Merge failed", { description: "Missing client context." })
      return
    }
    setMerging(true)
    try {
      const result = await executeShotMerge({
        clientId,
        primary,
        secondary,
        mode,
        user,
      })
      setMergeResult(result)
      setStep("result")
    } catch (err) {
      toast.error("Merge failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setMerging(false)
    }
  }, [clientId, primary, secondary, mode, user])

  const handleViewShot = useCallback(() => {
    if (!mergeResult) return
    onOpenChange(false)
    onMerged?.()
    navigate(`/projects/${projectId}/shots/${mergeResult.mergedShotId}`)
  }, [mergeResult, projectId, navigate, onOpenChange, onMerged])

  const handleClose = useCallback(() => {
    onOpenChange(false)
    onMerged?.()
  }, [onOpenChange, onMerged])

  // Prevent closing during merge.
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (merging) return
      onOpenChange(next)
    },
    [merging, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="heading-section">Merge shots</DialogTitle>
          <DialogDescription className="text-sm text-[var(--color-text-muted)]">
            Combine two shots into one. The secondary shot is soft-deleted (recoverable).
          </DialogDescription>
        </DialogHeader>

        <StepIndicator steps={STEPS} current={step} />

        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          {step === "compare" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <ShotCompareCard shot={shotA} isPrimary={aIsPrimary} />
                <ShotCompareCard shot={shotB} isPrimary={!aIsPrimary} />
              </div>

              <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] p-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  <span className="font-medium text-[var(--color-text)]">{primary.title}</span> is
                  kept as the primary; its title, date, location and status stay unchanged.
                </div>
                <Button variant="outline" size="sm" onClick={handleSwap}>
                  Swap
                </Button>
              </div>

              <fieldset className="space-y-2">
                <legend className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Merge mode
                </legend>
                <RadioGroup
                  value={mode}
                  onValueChange={(v) => setMode(v as ShotMergeMode)}
                  aria-label="Merge mode"
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {MODE_OPTIONS.map((opt) => {
                    const selected = mode === opt.key
                    const id = `merge-mode-${opt.key}`
                    return (
                      <div key={opt.key}>
                        <RadioGroupItem value={opt.key} id={id} className="sr-only" />
                        <label
                          htmlFor={id}
                          className={cn(
                            "block cursor-pointer rounded-md border p-3 text-left transition-colors",
                            selected
                              ? "border-[var(--color-primary)] bg-[var(--color-surface-subtle)]"
                              : "border-[var(--color-border)] hover:border-[var(--color-text-subtle)]",
                          )}
                        >
                          <div className="text-sm font-medium text-[var(--color-text)]">
                            {opt.label}
                          </div>
                          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {opt.helper}
                          </div>
                        </label>
                      </div>
                    )
                  })}
                </RadioGroup>
              </fieldset>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleToPreview}>
                  Next
                </Button>
              </div>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--color-border)] p-3">
                <div className="mb-2 text-sm font-semibold text-[var(--color-text)]">
                  {primary.title}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Products combined</dt>
                    <dd className="text-lg font-semibold text-[var(--color-text)]">
                      {preview.result.productsCombined}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Talent added</dt>
                    <dd className="text-lg font-semibold text-[var(--color-text)]">
                      {preview.result.talentAdded}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">References kept</dt>
                    <dd className="text-lg font-semibold text-[var(--color-text)]">
                      {preview.result.referencesKept}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Looks</dt>
                    <dd className="text-lg font-semibold text-[var(--color-text)]">
                      {preview.result.looksKept}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                  Primary meta kept (title, date, location, status).
                </p>
              </div>

              <div className="rounded-md border border-[var(--color-status-amber-border,var(--color-border))] bg-[var(--color-surface-subtle)] p-3 text-xs text-[var(--color-text-muted)]">
                &ldquo;{secondary.title}&rdquo; will be soft-deleted (recoverable).
              </div>

              <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--color-text)]">
                <Checkbox
                  checked={confirmed}
                  onCheckedChange={(v) => setConfirmed(v === true)}
                  className="mt-0.5"
                />
                <span>
                  I understand the secondary shot will be merged in and soft-deleted.
                </span>
              </label>

              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToCompare}
                  disabled={merging}
                >
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleMerge}
                  disabled={!confirmed || merging}
                >
                  <GitMerge className="mr-1.5 h-3.5 w-3.5" />
                  {merging ? "Merging…" : "Merge"}
                </Button>
              </div>
            </div>
          )}

          {step === "result" && mergeResult && (
            <div className="space-y-4">
              <div className="rounded-md border border-[var(--color-status-green-border,var(--color-border))] bg-[var(--color-status-green-bg)] p-3">
                <div className="text-sm font-semibold text-[var(--color-status-green-text)]">
                  Shots merged
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Products</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {mergeResult.productsCombined}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Talent added</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {mergeResult.talentAdded}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">References</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {mergeResult.referencesKept}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-subtle)]">Looks</dt>
                    <dd className="font-semibold text-[var(--color-text)]">
                      {mergeResult.looksKept}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleViewShot}>
                  View shot
                </Button>
                <Button size="sm" onClick={handleClose}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
