import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { bulkCreateShotsFromProducts } from "@/features/shots/lib/bulkShotWrites"
import type { SelectedFamily, SelectedSku } from "@/features/products/hooks/useProductSelection"
import type { BulkShotItem } from "@/features/shots/lib/bulkShotWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { toast } from "@/shared/hooks/use-toast"
import { cn } from "@/shared/lib/utils"

type Granularity = "family" | "sku"

interface BulkAddToProjectDialogProps {
  readonly selectedFamilies: readonly SelectedFamily[]
  readonly selectedSkus: readonly SelectedSku[]
  readonly familyGenderMap?: ReadonlyMap<string, string | null>
  readonly onClose: () => void
  readonly onSuccess: () => void
}

function buildFamilyItems(
  families: readonly SelectedFamily[],
  genderMap?: ReadonlyMap<string, string | null>,
): BulkShotItem[] {
  const seen = new Set<string>()
  const result: BulkShotItem[] = []
  for (const f of families) {
    if (!seen.has(f.familyId)) {
      seen.add(f.familyId)
      result.push({
        familyId: f.familyId,
        familyName: f.familyName,
        gender: genderMap?.get(f.familyId) ?? null,
      })
    }
  }
  return result
}

function buildSkuItems(
  skus: readonly SelectedSku[],
  genderMap?: ReadonlyMap<string, string | null>,
): BulkShotItem[] {
  return skus.map((s) => ({
    familyId: s.familyId,
    familyName: s.familyName,
    skuId: s.skuId,
    skuName: s.skuName,
    gender: genderMap?.get(s.familyId) ?? null,
  }))
}

export function BulkAddToProjectDialog({
  selectedFamilies,
  selectedSkus,
  familyGenderMap,
  onClose,
  onSuccess,
}: BulkAddToProjectDialogProps) {
  const { clientId, user } = useAuth()
  const navigate = useNavigate()
  const { data: projects } = useProjects()
  const [projectId, setProjectId] = useState<string>("")
  const [granularity, setGranularity] = useState<Granularity>(
    selectedSkus.length > 0 ? "sku" : "family",
  )
  const [loading, setLoading] = useState(false)

  const activeProjects = useMemo(
    () =>
      projects.filter(
        (p) =>
          (p.status ?? "active") === "active" && !p.deletedAt,
      ),
    [projects],
  )

  const previewItems = useMemo((): BulkShotItem[] => {
    if (granularity === "sku" && selectedSkus.length > 0) {
      return buildSkuItems(selectedSkus, familyGenderMap)
    }
    return buildFamilyItems(selectedFamilies, familyGenderMap)
  }, [granularity, selectedSkus, selectedFamilies, familyGenderMap])

  const shotCount = previewItems.length

  async function handleConfirm() {
    if (!projectId || !clientId || !user) return
    setLoading(true)
    try {
      const result = await bulkCreateShotsFromProducts({
        clientId,
        projectId,
        items: previewItems,
        createdBy: user.uid,
      })
      onSuccess()
      toast({
        title: `${result.created} shot${result.created !== 1 ? "s" : ""} created`,
        description: (
          <button
            type="button"
            className="underline"
            onClick={() => navigate(`/projects/${projectId}/shots`)}
          >
            View in project
          </button>
        ),
      })
    } catch {
      toast({
        title: "Failed to create shots",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const hasBothModes = selectedFamilies.length > 0 && selectedSkus.length > 0
  const canSubmit = Boolean(projectId) && shotCount > 0 && !loading && activeProjects.length > 0

  return (
    <ResponsiveDialog
      open
      onOpenChange={(open) => { if (!open) onClose() }}
      title="Add to Project"
      description="Choose a project and granularity to create shots from selected products."
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            data-testid="bulk-dialog-confirm"
          >
            {loading ? "Creating\u2026" : `Create ${shotCount} Shot${shotCount !== 1 ? "s" : ""}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Project picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-[var(--color-text)]">
            Project
          </label>
          {activeProjects.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">
              No active projects. Create a project first.
            </p>
          ) : (
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="w-full" data-testid="bulk-dialog-project-select">
                <SelectValue placeholder={"Select a project\u2026"} />
              </SelectTrigger>
              <SelectContent>
                {activeProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Granularity toggle — only show when both families and SKUs are selected */}
        {hasBothModes && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[var(--color-text)]">
              One shot per
            </label>
            <div
              className="inline-flex rounded-md border border-[var(--color-border)] p-0.5"
              role="group"
              aria-label="Granularity"
            >
              {(["family", "sku"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm transition-colors",
                    granularity === g
                      ? "bg-[var(--color-surface-raised)] font-medium text-[var(--color-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                  )}
                  onClick={() => setGranularity(g)}
                  data-testid={`bulk-dialog-granularity-${g}`}
                >
                  {g === "family" ? "Family" : "SKU (colorway)"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview list */}
        {shotCount > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm font-medium text-[var(--color-text)]">
              {shotCount} shot{shotCount !== 1 ? "s" : ""} will be created
            </p>
            <ul className="max-h-48 overflow-y-auto rounded-md border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {previewItems.slice(0, 20).map((item, i) => (
                <li
                  key={`${item.familyId}-${item.skuId ?? "fam"}-${i}`}
                  className="px-3 py-2 text-sm text-[var(--color-text-muted)]"
                >
                  {item.skuName
                    ? `${item.familyName} \u2014 ${item.skuName}`
                    : item.familyName}
                </li>
              ))}
              {shotCount > 20 && (
                <li className="px-3 py-2 text-xs text-[var(--color-text-subtle)]">
                  {"\u2026"} and {shotCount - 20} more
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
