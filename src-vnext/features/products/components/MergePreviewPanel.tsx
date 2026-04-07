import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Separator } from "@/ui/separator"
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Palette,
  FileText,
  Camera,
  FlaskConical,
  MessageSquare,
  XCircle,
} from "lucide-react"
import type { MergePlan } from "../lib/productDedup"
import { cn } from "@/shared/lib/utils"

interface MergePreviewPanelProps {
  readonly plan: MergePlan
  readonly adminConfirmed: boolean
  readonly merging: boolean
  readonly onAdminConfirmChange: (confirmed: boolean) => void
  readonly onExecuteMerge: () => void
}

function SummaryRow({
  icon,
  label,
  count,
  detail,
}: {
  readonly icon: React.ReactNode
  readonly label: string
  readonly count: number
  readonly detail: string
}) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 text-[var(--color-text-subtle)]">{icon}</div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text)]">{label}</span>
          <Badge variant="secondary" className="text-2xs">
            {count}
          </Badge>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">{detail}</p>
      </div>
    </div>
  )
}

export function MergePreviewPanel({
  plan,
  adminConfirmed,
  merging,
  onAdminConfirmChange,
  onExecuteMerge,
}: MergePreviewPanelProps) {
  const skusToAdd = plan.newSkus.length
  const skusMatched = plan.matchedSkus.length
  const shotCount = plan.affectedShotIds.length
  const allChecksPass = plan.checks.every((c) => c.passed)
  const canMerge = allChecksPass && adminConfirmed && !merging && !plan.hasDataLoss

  return (
    <div className="flex flex-col gap-4">
      {/* Merge summary */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Merge Summary
        </p>
        <div className="mt-2 flex flex-col divide-y divide-[var(--color-border)]">
          <SummaryRow
            icon={<Palette className="h-4 w-4" />}
            label="Colorways to add"
            count={skusToAdd}
            detail={
              skusToAdd > 0
                ? `${skusToAdd} new colorway${skusToAdd === 1 ? "" : "s"} will be added to the winner`
                : "No new colorways to add"
            }
          />
          <SummaryRow
            icon={<Palette className="h-4 w-4" />}
            label="Colorways matched"
            count={skusMatched}
            detail={
              skusMatched > 0
                ? `${skusMatched} colorway${skusMatched === 1 ? "" : "s"} already exist (will be skipped)`
                : "No overlapping colorways"
            }
          />
          <SummaryRow
            icon={<FlaskConical className="h-4 w-4" />}
            label="Samples to transfer"
            count={plan.samplesToTransfer}
            detail={
              plan.samplesToTransfer > 0
                ? `${plan.samplesToTransfer} sample${plan.samplesToTransfer === 1 ? "" : "s"} will be transferred`
                : "No samples to transfer"
            }
          />
          <SummaryRow
            icon={<MessageSquare className="h-4 w-4" />}
            label="Comments to transfer"
            count={plan.commentsToTransfer}
            detail={
              plan.commentsToTransfer > 0
                ? `${plan.commentsToTransfer} comment${plan.commentsToTransfer === 1 ? "" : "s"} will be transferred`
                : "No comments to transfer"
            }
          />
          <SummaryRow
            icon={<FileText className="h-4 w-4" />}
            label="Documents to transfer"
            count={plan.documentsToTransfer}
            detail={
              plan.documentsToTransfer > 0
                ? `${plan.documentsToTransfer} document${plan.documentsToTransfer === 1 ? "" : "s"} will be transferred`
                : "No documents to transfer"
            }
          />
        </div>
      </div>

      <Separator />

      {/* References to update */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          References to Update
        </p>
        <div className="mt-2 flex flex-col divide-y divide-[var(--color-border)]">
          <SummaryRow
            icon={<Camera className="h-4 w-4" />}
            label="Shots to update"
            count={shotCount}
            detail={
              shotCount > 0
                ? `${shotCount} shot${shotCount === 1 ? "" : "s"} will be re-pointed to the winner`
                : "No shot references to update"
            }
          />
        </div>
      </div>

      <Separator />

      {/* After merge */}
      <div className="rounded-md border border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-[var(--color-status-amber-text)]" />
          <div>
            <p className="text-sm font-medium text-[var(--color-status-amber-text)]">
              After Merge
            </p>
            <p className="mt-0.5 text-xs text-[var(--color-status-amber-text)]">
              The loser product ({plan.loser.styleName}) will be soft-deleted. It can be viewed via
              the "Show deleted" filter but should not be reactivated.
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Verification checklist (from plan.checks) */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
          Verification
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {plan.checks.map((check) => (
            <div key={check.label} className="flex items-start gap-2">
              {check.passed ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-[var(--color-status-green-text)]" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 text-[var(--color-status-red-text)]" />
              )}
              <div className="flex flex-col gap-0.5">
                <span className={cn(
                  "text-sm",
                  check.passed ? "text-[var(--color-text)]" : "text-[var(--color-status-red-text)]",
                )}>
                  {check.label}
                </span>
                {check.detail && (
                  <span className="text-xs text-[var(--color-text-muted)]">{check.detail}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Admin confirmation */}
      <div className="flex items-start gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <Checkbox
          id="admin-confirm"
          checked={adminConfirmed}
          onCheckedChange={(checked) => onAdminConfirmChange(checked === true)}
          disabled={merging}
        />
        <label htmlFor="admin-confirm" className="cursor-pointer text-sm text-[var(--color-text)]">
          I confirm this merge is correct and understand it cannot be easily undone
        </label>
      </div>

      {/* Action */}
      <div className="flex justify-end">
        <Button
          variant="destructive"
          onClick={onExecuteMerge}
          disabled={!canMerge}
        >
          {merging ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {"Merging\u2026"}
            </>
          ) : (
            "Merge Products"
          )}
        </Button>
      </div>
    </div>
  )
}
