import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/shared/lib/utils"
import type { ProductFamily } from "@/shared/types"
import {
  detectDuplicates,
  buildMergePlan,
  type DuplicateGroup,
  type MergePlan,
} from "../lib/productDedup"
import { executeProductMerge, type MergeResult } from "../lib/productMergeWrites"
import { MergeDetectionPanel } from "./MergeDetectionPanel"
import { MergeComparePanel } from "./MergeComparePanel"
import { MergePreviewPanel } from "./MergePreviewPanel"
import { MergeResultPanel } from "./MergeResultPanel"

interface ProductMergeWizardProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly clientId: string
  readonly userId: string
  readonly families: ReadonlyArray<ProductFamily>
}

type WizardStep = "detect" | "compare" | "preview" | "result"

const STEPS: ReadonlyArray<{ readonly key: WizardStep; readonly label: string }> = [
  { key: "detect", label: "Detection" },
  { key: "compare", label: "Compare" },
  { key: "preview", label: "Preview" },
  { key: "result", label: "Result" },
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

export function ProductMergeWizard({
  open,
  onOpenChange,
  clientId,
  userId,
  families,
}: ProductMergeWizardProps) {
  const navigate = useNavigate()

  const [step, setStep] = useState<WizardStep>("detect")
  const [winner, setWinner] = useState<ProductFamily | null>(null)
  const [loser, setLoser] = useState<ProductFamily | null>(null)
  const [mergePlan, setMergePlan] = useState<MergePlan | null>(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [merging, setMerging] = useState(false)
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null)
  const [adminConfirmed, setAdminConfirmed] = useState(false)

  const duplicateGroups = useMemo(
    () => detectDuplicates(families),
    [families],
  )

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep("detect")
      setWinner(null)
      setLoser(null)
      setMergePlan(null)
      setPlanLoading(false)
      setMerging(false)
      setMergeResult(null)
      setAdminConfirmed(false)
    }
  }, [open])

  const handleSelectGroup = useCallback((group: DuplicateGroup) => {
    const first = group.families[0]
    const second = group.families[1]
    if (!first || !second) return
    setWinner(first)
    setLoser(second)
    setMergePlan(null)
    setAdminConfirmed(false)
    setStep("compare")
  }, [])

  const handleSwap = useCallback(() => {
    setWinner((prevWinner) => {
      setLoser(prevWinner)
      return loser
    })
  }, [loser])

  const handlePlanMerge = useCallback(async () => {
    if (!winner || !loser) return
    setPlanLoading(true)
    try {
      const plan = await buildMergePlan({
        winner,
        loser,
        clientId,
      })
      setMergePlan(plan)
      setAdminConfirmed(false)
      setStep("preview")
    } catch (err) {
      toast.error("Failed to plan merge", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setPlanLoading(false)
    }
  }, [winner, loser, clientId])

  const handleExecuteMerge = useCallback(async () => {
    if (!winner || !loser || !mergePlan) return
    setMerging(true)
    try {
      const result = await executeProductMerge({
        winnerId: winner.id,
        loserId: loser.id,
        clientId,
        mergedBy: userId,
        plan: mergePlan,
        winnerFamily: winner,
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
  }, [winner, loser, mergePlan, clientId, userId])

  const handleViewProduct = useCallback(() => {
    if (winner) {
      onOpenChange(false)
      navigate(`/products/${winner.id}`)
    }
  }, [winner, navigate, onOpenChange])

  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // Prevent closing during merge
  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (merging) return
      onOpenChange(next)
    },
    [merging, onOpenChange],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="heading-section">Product Merge Wizard</DialogTitle>
          <DialogDescription className="text-sm text-[var(--color-text-muted)]">
            Detect and resolve duplicate products by merging them together.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <StepIndicator steps={STEPS} current={step} />

        {/* Step content */}
        <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
          {step === "detect" && (
            <MergeDetectionPanel
              duplicateGroups={duplicateGroups}
              onSelectGroup={handleSelectGroup}
            />
          )}

          {step === "compare" && winner && loser && (
            <MergeComparePanel
              winner={winner}
              loser={loser}
              planLoading={planLoading}
              onSwap={handleSwap}
              onPlanMerge={handlePlanMerge}
            />
          )}

          {step === "preview" && mergePlan && (
            <MergePreviewPanel
              plan={mergePlan}
              adminConfirmed={adminConfirmed}
              merging={merging}
              onAdminConfirmChange={setAdminConfirmed}
              onExecuteMerge={handleExecuteMerge}
            />
          )}

          {step === "result" && mergeResult && winner && (
            <MergeResultPanel
              result={mergeResult}
              winnerName={winner.styleName}
              onViewProduct={handleViewProduct}
              onClose={handleClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
