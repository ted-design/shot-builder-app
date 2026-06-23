import { useCallback, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Package, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { Button, buttonVariants } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { useExportReports } from "../../hooks/useExportReports"
import { DEFAULT_PRODUCT_INFO_CONFIG } from "../../lib/report/productInfoTypes"

// Saved product-info reports for a project: create, open, and delete. Sits beside
// the single report page; never touches the legacy block-canvas builder or the
// shot-report list. Flag-gated route. Mirrors ShotReportListPage.

export default function ProductInfoReportListPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { clientId } = useAuth()
  const navigate = useNavigate()
  const { reports, loading, createProductInfoReport, deleteReport } = useExportReports(
    clientId,
    projectId,
  )

  const productReports = useMemo(
    () => reports.filter((r) => r.reportType === "product-info"),
    [reports],
  )

  const [newName, setNewName] = useState("")
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const openReport = useCallback(
    (reportId: string) =>
      navigate(`/projects/${projectId}/export/product-report?reportId=${reportId}`),
    [navigate, projectId],
  )

  const handleCreate = useCallback(async () => {
    setBusy(true)
    try {
      const id = await createProductInfoReport(
        newName.trim() || "Untitled report",
        DEFAULT_PRODUCT_INFO_CONFIG,
      )
      setNewName("")
      openReport(id)
    } catch {
      toast.error("Couldn't create the report")
    } finally {
      setBusy(false)
    }
  }, [createProductInfoReport, newName, openReport])

  const handleDelete = useCallback(
    async (reportId: string) => {
      try {
        await deleteReport(reportId)
        toast.success("Report deleted")
      } catch {
        toast.error("Couldn't delete the report")
      }
    },
    [deleteReport],
  )

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Product Info" />

      <div className="mb-6 flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void handleCreate()
          }}
          placeholder="New report name…"
          aria-label="New report name"
          className="flex-1"
        />
        <Button onClick={() => void handleCreate()} disabled={busy}>
          <Plus /> Create report
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : productReports.length === 0 ? (
        <EmptyState
          icon={<Package className="h-8 w-8" />}
          title="No product info reports yet"
          description="Create a report above to lay out every product in use as a printable info sheet, then export it as a PDF."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
          {productReports.map((r) => (
            <li key={r.id} className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => openReport(r.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                  {r.name}
                </span>
                {r.updatedAt ? (
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    Updated {r.updatedAt.toLocaleDateString()}
                  </span>
                ) : null}
              </button>
              <Button variant="outline" size="sm" onClick={() => openReport(r.id)}>
                Open
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPendingDelete({ id: r.id, name: r.name })}
                disabled={busy}
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be permanently deleted. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (pendingDelete) void handleDelete(pendingDelete.id)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
