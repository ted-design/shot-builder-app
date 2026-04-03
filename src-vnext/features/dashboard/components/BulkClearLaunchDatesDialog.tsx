import { useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilySkusPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { applyLaunchDateToAllSkus } from "@/features/products/lib/productWorkspaceWrites"
import type { SelectedFamily } from "@/features/products/hooks/useProductSelection"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { toast } from "@/shared/hooks/use-toast"
import { Loader2 } from "lucide-react"

interface BulkClearLaunchDatesDialogProps {
  readonly selectedFamilies: readonly SelectedFamily[]
  readonly onClose: () => void
  readonly onSuccess: () => void
}

export function BulkClearLaunchDatesDialog({
  selectedFamilies,
  onClose,
  onSuccess,
}: BulkClearLaunchDatesDialogProps) {
  const { clientId, user } = useAuth()
  const [clearing, setClearing] = useState(false)
  const count = selectedFamilies.length

  const handleClear = async () => {
    if (!clientId || !user?.uid || count === 0) return
    setClearing(true)
    let cleared = 0

    try {
      for (const family of selectedFamilies) {
        // Fetch SKU IDs for this family (one-time read, not subscription)
        const skuPath = productFamilySkusPath(family.familyId, clientId)
        const skuSnap = await getDocs(collection(db, skuPath[0]!, ...skuPath.slice(1)))
        const skuIds = skuSnap.docs
          .filter((d) => d.data().deleted !== true)
          .map((d) => d.id)

        await applyLaunchDateToAllSkus({
          clientId,
          familyId: family.familyId,
          skuIds,
          userId: user.uid,
          launchDate: null,
          user,
        })
        cleared += 1
      }

      toast({
        title: "Launch dates cleared",
        description: `Cleared ${cleared} product${cleared !== 1 ? "s" : ""} and their colorways.`,
      })
      onSuccess()
    } catch (err) {
      toast({
        title: "Clear failed",
        description: `${cleared} of ${count} cleared. ${err instanceof Error ? err.message : "Could not clear launch dates."}`,
      })
    } finally {
      setClearing(false)
    }
  }

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title="Clear launch dates"
      description={`Remove launch dates from ${count} product${count !== 1 ? "s" : ""} and all their colorways.`}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={clearing}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleClear()}
            disabled={clearing || count === 0}
          >
            {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {clearing ? "Clearing..." : `Clear ${count} product${count !== 1 ? "s" : ""}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="rounded-md border border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] p-3 text-xs text-[var(--color-status-amber-text)]">
          This will remove launch dates from the family and all colorways. Products without shoot requirements will no longer appear in this view.
        </div>

        <div className="max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-2">
          {selectedFamilies.map((f) => (
            <div
              key={f.familyId}
              className="py-1 text-xs text-[var(--color-text)]"
            >
              {f.familyName}
            </div>
          ))}
        </div>
      </div>
    </ResponsiveDialog>
  )
}
