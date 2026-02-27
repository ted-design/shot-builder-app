import { useMemo, useState } from "react"
import type { ProductFamily, ProductSample, ProductSampleStatus, ProductSampleType, ProductSku } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "@/shared/hooks/use-toast"
import {
  createProductSample,
  updateProductSample,
} from "@/features/products/lib/productWorkspaceWrites"
import {
  formatDateTime,
  parseDateInput,
  sampleSortKey,
  isSampleOverdue,
  isSampleDueSoon,
} from "@/features/products/lib/productDetailHelpers"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Textarea } from "@/ui/textarea"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet"
import { AlertTriangle, Box, Clock, Plus, Trash2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

type SampleStatusFilter = "all" | ProductSampleStatus
type SampleTypeFilter = "all" | ProductSampleType

const SCOPE_ALL_VALUE = "__all__"

const STATUS_PIPELINE: ReadonlyArray<{ key: SampleStatusFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "requested", label: "Requested" },
  { key: "in_transit", label: "In transit" },
  { key: "arrived", label: "Arrived" },
  { key: "returned", label: "Returned" },
  { key: "issue", label: "Issues" },
]

interface ProductSamplesSectionProps {
  readonly family: ProductFamily
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly samples: ReadonlyArray<ProductSample>
  readonly samplesLoading: boolean
  readonly samplesError: { message: string } | null
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly isFamilyDeleted: boolean
}

export function ProductSamplesSection({
  family,
  activeSkus,
  samples,
  samplesLoading,
  samplesError,
  canEdit,
  clientId,
  userId,
  isFamilyDeleted,
}: ProductSamplesSectionProps) {
  const [statusFilter, setStatusFilter] = useState<SampleStatusFilter>("all")
  const [typeFilter, setTypeFilter] = useState<SampleTypeFilter>("all")
  const [scopeSkuId, setScopeSkuId] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeSample, setActiveSample] = useState<ProductSample | null>(null)
  const [saving, setSaving] = useState(false)
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [draft, setDraft] = useState<{
    readonly type: ProductSampleType
    readonly status: ProductSampleStatus
    readonly sizeRunCsv: string
    readonly carrier: string
    readonly tracking: string
    readonly eta: string
    readonly notes: string
    readonly scopeSkuId: string
  }>({
    type: "shoot",
    status: "requested",
    sizeRunCsv: "",
    carrier: "",
    tracking: "",
    eta: "",
    notes: "",
    scopeSkuId: "",
  })

  const visibleSamples = useMemo(() => samples.filter((s) => s.deleted !== true), [samples])

  const scopeSkuOptions = useMemo(() => {
    return activeSkus
      .map((sku) => ({ id: sku.id, label: sku.colorName ?? sku.name }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [activeSkus])

  const scopedSamples = useMemo(() => {
    if (!scopeSkuId) return visibleSamples
    return visibleSamples.filter((s) => s.scopeSkuId === scopeSkuId)
  }, [scopeSkuId, visibleSamples])

  const statusCounts = useMemo(() => {
    const base: Record<SampleStatusFilter, number> = {
      all: scopedSamples.length,
      requested: 0,
      in_transit: 0,
      arrived: 0,
      returned: 0,
      issue: 0,
    }
    for (const s of scopedSamples) {
      base[s.status] += 1
    }
    return base
  }, [scopedSamples])

  const filteredSamples = useMemo(() => {
    let out = [...scopedSamples]
    if (statusFilter !== "all") out = out.filter((s) => s.status === statusFilter)
    if (typeFilter !== "all") out = out.filter((s) => s.type === typeFilter)
    out.sort((a, b) => sampleSortKey(b) - sampleSortKey(a))
    return out
  }, [statusFilter, typeFilter, scopedSamples])

  const openNewSample = () => {
    setActiveSample(null)
    setDraft({
      type: "shoot",
      status: "requested",
      sizeRunCsv: "",
      carrier: "",
      tracking: "",
      eta: "",
      notes: "",
      scopeSkuId: scopeSkuId || "",
    })
    setDeleteConfirmOpen(false)
    setSheetOpen(true)
  }

  const openEditSample = (sample: ProductSample) => {
    setActiveSample(sample)
    setDraft({
      type: sample.type,
      status: sample.status,
      sizeRunCsv: (sample.sizeRun ?? []).join(", "),
      carrier: sample.carrier ?? "",
      tracking: sample.tracking ?? "",
      eta: sample.eta ? sample.eta.toDate().toISOString().slice(0, 10) : "",
      notes: sample.notes ?? "",
      scopeSkuId: sample.scopeSkuId ?? "",
    })
    setDeleteConfirmOpen(false)
    setSheetOpen(true)
  }

  const handleSave = () => {
    if (!clientId) return
    setSaving(true)
    const eta = parseDateInput(draft.eta)
    const arrivedAt =
      draft.status === "arrived" && !(activeSample?.arrivedAt) ? new Date() : null

    const op = activeSample
      ? updateProductSample({
          clientId,
          familyId: family.id,
          sampleId: activeSample.id,
          userId,
          patch: {
            type: draft.type,
            status: draft.status,
            sizeRun: draft.sizeRunCsv.split(",").map((s) => s.trim()).filter(Boolean),
            carrier: draft.carrier || null,
            tracking: draft.tracking || null,
            eta,
            arrivedAt: arrivedAt ?? undefined,
            notes: draft.notes || null,
            scopeSkuId: draft.scopeSkuId || null,
          },
        })
      : createProductSample({
          clientId,
          familyId: family.id,
          userId,
          type: draft.type,
          status: draft.status,
          sizeRunCsv: draft.sizeRunCsv,
          carrier: draft.carrier || null,
          tracking: draft.tracking || null,
          eta,
          notes: draft.notes || null,
          scopeSkuId: draft.scopeSkuId || null,
        })

    void Promise.resolve(op)
      .then(() => {
        toast({ title: "Saved", description: "Sample saved." })
        setSheetOpen(false)
      })
      .catch((err) => {
        toast({
          title: "Save failed",
          description: err instanceof Error ? err.message : "Failed to save sample.",
        })
      })
      .finally(() => setSaving(false))
  }

  const handleInlineStatusChange = (sample: ProductSample, nextStatus: ProductSampleStatus) => {
    if (!clientId) return
    setMutatingId(sample.id)
    void updateProductSample({
      clientId,
      familyId: family.id,
      sampleId: sample.id,
      userId,
      patch: {
        status: nextStatus,
        arrivedAt: nextStatus === "arrived" && !sample.arrivedAt ? new Date() : undefined,
      },
    })
      .catch((err) => {
        toast({
          title: "Update failed",
          description: err instanceof Error ? err.message : "Failed to update sample.",
        })
      })
      .finally(() => setMutatingId(null))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Samples</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            Track sample requests, shipping, arrivals, and issues.
          </p>
        </div>
        {canEdit && !isFamilyDeleted && (
          <Button type="button" onClick={openNewSample} disabled={!clientId || saving || samplesLoading}>
            <Plus className="h-4 w-4" />
            Add sample
          </Button>
        )}
      </div>

      {samplesError && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
          {samplesError.message}
        </div>
      )}

      {samplesLoading ? (
        <LoadingState loading />
      ) : (
        <>
          {/* Status pipeline */}
          <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_PIPELINE.map((opt) => (
                <Button
                  key={opt.key}
                  type="button"
                  variant={statusFilter === opt.key ? "secondary" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setStatusFilter(opt.key)}
                >
                  {opt.label}
                  <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                    {statusCounts[opt.key]}
                  </span>
                </Button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Scope</Label>
                <Select
                  value={scopeSkuId || SCOPE_ALL_VALUE}
                  onValueChange={(value) => setScopeSkuId(value === SCOPE_ALL_VALUE ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All colorways" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SCOPE_ALL_VALUE}>All colorways</SelectItem>
                    {scopeSkuOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Type</Label>
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as SampleTypeFilter)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="shoot">Shoot</SelectItem>
                    <SelectItem value="pre_production">Pre-production</SelectItem>
                    <SelectItem value="bulk">Bulk</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1">
                <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Showing</Label>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)]">
                  {filteredSamples.length} {filteredSamples.length === 1 ? "sample" : "samples"}
                </div>
              </div>
            </div>
          </div>

          {filteredSamples.length === 0 ? (
            <InlineEmpty
              icon={<Box className="h-8 w-8" />}
              title="No samples"
              description="No samples match the current filters."
              action={
                canEdit && !isFamilyDeleted ? (
                  <Button type="button" variant="outline" size="sm" onClick={openNewSample}>
                    <Plus className="h-4 w-4" />
                    Add sample
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              {filteredSamples.map((sample) => (
                <SampleRow
                  key={sample.id}
                  sample={sample}
                  scopeSkuOptions={scopeSkuOptions}
                  canEdit={canEdit}
                  isFamilyDeleted={isFamilyDeleted}
                  mutatingId={mutatingId}
                  onEdit={openEditSample}
                  onStatusChange={handleInlineStatusChange}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Sample create/edit sheet */}
      <Sheet open={sheetOpen} onOpenChange={(open) => { setSheetOpen(open); if (!open) setActiveSample(null) }}>
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{activeSample ? "Edit sample" : "Add sample"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={draft.type}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, type: value as ProductSampleType }))}
                  disabled={saving}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shoot">Shoot</SelectItem>
                    <SelectItem value="pre_production">Pre-production</SelectItem>
                    <SelectItem value="bulk">Bulk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, status: value as ProductSampleStatus }))}
                  disabled={saving}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="in_transit">In transit</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Scope</Label>
                <Select
                  value={draft.scopeSkuId || SCOPE_ALL_VALUE}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, scopeSkuId: value === SCOPE_ALL_VALUE ? "" : value }))}
                  disabled={saving}
                >
                  <SelectTrigger><SelectValue placeholder="All colorways" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SCOPE_ALL_VALUE}>All colorways</SelectItem>
                    {scopeSkuOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">ETA</Label>
                <Input
                  type="date"
                  value={draft.eta}
                  disabled={saving}
                  onChange={(e) => setDraft((prev) => ({ ...prev, eta: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Carrier</Label>
                <Input
                  value={draft.carrier}
                  disabled={saving}
                  onChange={(e) => setDraft((prev) => ({ ...prev, carrier: e.target.value }))}
                  placeholder="UPS, FedEx…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tracking</Label>
                <Input
                  value={draft.tracking}
                  disabled={saving}
                  onChange={(e) => setDraft((prev) => ({ ...prev, tracking: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Size run (CSV)</Label>
              <Input
                value={draft.sizeRunCsv}
                disabled={saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, sizeRunCsv: e.target.value }))}
                placeholder="XS, S, M"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={draft.notes}
                disabled={saving}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any context your team will need…"
              />
            </div>

            {activeSample && (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-xs text-[var(--color-text-muted)]">
                Created {formatDateTime(activeSample.createdAt)} · Updated {formatDateTime(activeSample.updatedAt ?? activeSample.createdAt)}
              </div>
            )}
          </div>

          <SheetFooter className="mt-4">
            {activeSample && canEdit && !isFamilyDeleted && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-[var(--color-error)] hover:text-[var(--color-error)]"
                disabled={saving}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete sample
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setSheetOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !clientId || isFamilyDeleted}
              onClick={handleSave}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete sample?"
        description="This hides the sample from default views. You can restore it later."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId || !activeSample) return
          setSaving(true)
          void updateProductSample({
            clientId,
            familyId: family.id,
            sampleId: activeSample.id,
            userId,
            patch: { deleted: true },
          })
            .then(() => {
              toast({ title: "Deleted", description: "Sample deleted." })
              setSheetOpen(false)
              setDeleteConfirmOpen(false)
            })
            .catch((err) => {
              toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete sample.",
              })
            })
            .finally(() => setSaving(false))
        }}
      />
    </div>
  )
}

function SampleRow({
  sample,
  scopeSkuOptions,
  canEdit,
  isFamilyDeleted,
  mutatingId,
  onEdit,
  onStatusChange,
}: {
  readonly sample: ProductSample
  readonly scopeSkuOptions: ReadonlyArray<{ id: string; label: string }>
  readonly canEdit: boolean
  readonly isFamilyDeleted: boolean
  readonly mutatingId: string | null
  readonly onEdit: (sample: ProductSample) => void
  readonly onStatusChange: (sample: ProductSample, status: ProductSampleStatus) => void
}) {
  const overdue = isSampleOverdue(sample)
  const dueSoon = !overdue && isSampleDueSoon(sample)

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-subtle)]"
      onClick={() => onEdit(sample)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onEdit(sample)
        }
      }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text)]">
            {sample.type === "pre_production" ? "Pre-production" : sample.type === "bulk" ? "Bulk" : "Shoot"}
          </span>
          <Badge variant="outline" className="text-xs font-normal text-[var(--color-text-muted)]">
            {sample.status.split("_").join(" ")}
          </Badge>
          {sample.scopeSkuId && (
            <Badge variant="outline" className="text-xs font-normal text-[var(--color-text-muted)]">
              {scopeSkuOptions.find((o) => o.id === sample.scopeSkuId)?.label ?? "Colorway"}
            </Badge>
          )}
          {overdue && (
            <Badge className={cn("gap-1 border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300")}>
              <AlertTriangle className="h-3 w-3" />
              Overdue
            </Badge>
          )}
          {dueSoon && (
            <Badge className={cn("gap-1 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300")}>
              <Clock className="h-3 w-3" />
              Due soon
            </Badge>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
          Sizes: {(sample.sizeRun ?? []).join(", ") || "—"} · ETA: {formatDateTime(sample.eta)}
          {sample.tracking ? ` · Tracking: ${sample.tracking}` : ""}
        </div>
      </div>

      {canEdit && !isFamilyDeleted ? (
        <div
          className="flex shrink-0 items-center gap-2"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Select
            value={sample.status}
            onValueChange={(value) => onStatusChange(sample, value as ProductSampleStatus)}
            disabled={mutatingId === sample.id}
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requested">Requested</SelectItem>
              <SelectItem value="in_transit">In transit</SelectItem>
              <SelectItem value="arrived">Arrived</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="issue">Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="shrink-0 text-xs text-[var(--color-text-subtle)]">
          Updated {formatDateTime(sample.updatedAt ?? sample.createdAt)}
        </div>
      )}
    </div>
  )
}
