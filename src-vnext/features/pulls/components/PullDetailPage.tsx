import { useParams, useNavigate } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { FulfillmentToggle } from "@/features/pulls/components/FulfillmentToggle"
import { usePull } from "@/features/pulls/hooks/usePull"
import { updatePullField } from "@/features/pulls/lib/updatePull"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canManagePulls, canFulfillPulls } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import {
  getPullStatusLabel,
  getPullStatusColor,
  getFulfillmentStatusLabel,
  getFulfillmentStatusColor,
} from "@/shared/lib/statusMappings"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Separator } from "@/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ArrowLeft, Share2, Package } from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"
import type { FulfillmentFirestoreStatus, PullFirestoreStatus, PullItem } from "@/shared/types"
import { PULL_STATUSES } from "@/shared/lib/statusMappings"

export default function PullDetailPage() {
  const { pid } = useParams<{ pid: string }>()
  const navigate = useNavigate()
  const { data: pull, loading, error } = usePull(pid)
  const { role, clientId } = useAuth()
  const { projectId } = useProjectScope()
  const isMobile = useIsMobile()

  const canEdit = canManagePulls(role) && !isMobile
  const canFulfill = canFulfillPulls(role)

  const save = async (fields: Record<string, unknown>) => {
    if (!pull || !clientId) return
    try {
      await updatePullField(pull.id, projectId, clientId, fields)
    } catch {
      toast.error("Failed to save changes")
    }
  }

  const handleFulfillmentUpdate = async (
    itemIndex: number,
    newStatus: FulfillmentFirestoreStatus,
  ) => {
    if (!pull) return
    const updatedItems = pull.items.map((item, i) =>
      i === itemIndex ? { ...item, fulfillmentStatus: newStatus } : item,
    )
    await save({ items: updatedItems })
  }

  const handleStatusChange = async (status: string) => {
    const [optimistic, setOptimistic] = statusOptimistic
    setOptimistic(status as PullFirestoreStatus)
    try {
      await save({ status })
      setOptimistic(null)
    } catch {
      setOptimistic(null)
      toast.error("Failed to update status")
    }
  }

  const statusOptimistic = useState<PullFirestoreStatus | null>(null)

  const handleShareToggle = async () => {
    if (!pull) return
    const nextEnabled = !pull.shareEnabled
    const fields: Record<string, unknown> = {
      shareEnabled: nextEnabled,
      // Warehouse flow depends on callable `publicUpdatePull` which requires this flag.
      shareAllowResponses: nextEnabled,
    }
    if (nextEnabled && !pull.shareToken) {
      fields["shareToken"] = crypto.randomUUID()
    }
    await save(fields)
    toast.success(nextEnabled ? "Pull sheet shared" : "Sharing disabled")
  }

  if (loading) return <LoadingState loading />
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
      </div>
    )
  }
  if (!pull) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Pull sheet not found.</p>
      </div>
    )
  }

  const displayStatus = statusOptimistic[0] ?? pull.status

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-[var(--color-text)]">
              {pull.name || "Pull Sheet"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={displayStatus}
              onValueChange={handleStatusChange}
              disabled={!canEdit}
            >
              <SelectTrigger className="h-8 w-[140px]">
                <SelectValue>
                  <StatusBadge
                    label={getPullStatusLabel(displayStatus)}
                    color={getPullStatusColor(displayStatus)}
                  />
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {PULL_STATUSES.map((s) => (
                  <SelectItem key={s.firestoreValue} value={s.firestoreValue}>
                    <StatusBadge label={s.label} color={s.color} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button
                variant={pull.shareEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleShareToggle}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {pull.shareEnabled ? "Shared" : "Share"}
              </Button>
            )}
          </div>
        </div>

        {pull.shareEnabled && pull.shareToken && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
            <p className="text-xs text-[var(--color-text-muted)]">
              Share link:{" "}
              <span className="select-all font-mono text-[var(--color-primary)]">
                {window.location.origin}/pulls/shared/{pull.shareToken}
              </span>
            </p>
          </div>
        )}

        <Separator />

        {pull.items.length === 0 ? (
          <EmptyState
            icon={<Package className="h-12 w-12" />}
            title="No items in this pull sheet"
            description="Items will appear here when products are assigned to shots."
          />
        ) : (
          <div className="flex flex-col gap-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Items ({pull.items.length})
            </Label>
            {pull.items.map((item, index) => (
              <PullItemRow
                key={`${item.familyId}-${index}`}
                item={item}
                index={index}
                onUpdate={handleFulfillmentUpdate}
                canFulfill={canFulfill}
              />
            ))}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

function PullItemRow({
  item,
  index,
  onUpdate,
  canFulfill,
}: {
  readonly item: PullItem
  readonly index: number
  readonly onUpdate: (index: number, status: FulfillmentFirestoreStatus) => Promise<void>
  readonly canFulfill: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium">
          {item.familyName ?? item.familyId}
          {item.colourName && (
            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
              {item.colourName}
            </span>
          )}
        </CardTitle>
        <FulfillmentToggle
          currentStatus={item.fulfillmentStatus}
          onUpdate={(status) => onUpdate(index, status)}
          disabled={!canFulfill}
        />
      </CardHeader>
      {item.sizes.length > 0 && (
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {item.sizes.map((s) => (
              <span
                key={s.size}
                className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] px-2 py-1 text-xs"
              >
                <span className="font-medium">{s.size}</span>
                <span className="text-[var(--color-text-muted)]">
                  x{s.quantity}
                </span>
                {s.quantity > 0 && s.fulfilled >= s.quantity && (
                  <span className="text-[var(--color-success)]">✓</span>
                )}
              </span>
            ))}
          </div>
          {item.notes && (
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              {item.notes}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
