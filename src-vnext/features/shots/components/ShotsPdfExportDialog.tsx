import { useEffect, useMemo, useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Checkbox } from "@/ui/checkbox"
import { Separator } from "@/ui/separator"
import { toast } from "sonner"
import { buildShotsPdfRows } from "@/features/shots/lib/buildShotsPdfRows"
import { ShotsListPdfDocument, type ShotsPdfLayout, type ShotsPdfOrientation } from "@/features/shots/lib/shotsPdfTemplates"
import type { Shot } from "@/shared/types"

type ExportScope = "project" | "selected"

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function formatGeneratedAt(): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())
  } catch {
    return new Date().toISOString()
  }
}

function safeFileName(name: string): string {
  return name.replace(/[^\w\s.-]+/g, "").trim().replace(/\s+/g, " ")
}

export function ShotsPdfExportDialog({
  open,
  onOpenChange,
  projectName,
  shotsAll,
  shotsSelected,
  talentNameById,
  locationNameById,
  storageKeyBase,
}: {
  readonly open: boolean
  readonly onOpenChange: (next: boolean) => void
  readonly projectName: string
  readonly shotsAll: readonly Shot[]
  readonly shotsSelected: readonly Shot[]
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly storageKeyBase?: string | null
}) {
  const hasSelection = shotsSelected.length > 0

  const [scope, setScope] = useState<ExportScope>(hasSelection ? "selected" : "project")
  const [layout, setLayout] = useState<ShotsPdfLayout>("table")
  const [orientation, setOrientation] = useState<ShotsPdfOrientation>("portrait")
  const [includeHero, setIncludeHero] = useState(true)
  const [includeDescription, setIncludeDescription] = useState(false)
  const [includeNotesAddendum, setIncludeNotesAddendum] = useState(true)

  const [exporting, setExporting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Load preferences on open.
  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) {
      setScope(hasSelection ? "selected" : "project")
      return
    }
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:pdfExport:v1`)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        scope: ExportScope
        layout: ShotsPdfLayout
        orientation: ShotsPdfOrientation
        includeHero: boolean
        includeDescription: boolean
        includeNotesAddendum: boolean
      }>
      if (parsed.scope === "project" || parsed.scope === "selected") {
        setScope(parsed.scope === "selected" && hasSelection ? "selected" : "project")
      }
      if (parsed.layout === "table" || parsed.layout === "cards") setLayout(parsed.layout)
      if (parsed.orientation === "portrait" || parsed.orientation === "landscape") setOrientation(parsed.orientation)
      if (typeof parsed.includeHero === "boolean") setIncludeHero(parsed.includeHero)
      if (typeof parsed.includeDescription === "boolean") setIncludeDescription(parsed.includeDescription)
      if (typeof parsed.includeNotesAddendum === "boolean") setIncludeNotesAddendum(parsed.includeNotesAddendum)
    } catch {
      // ignore
    }
  }, [hasSelection, open, storageKeyBase])

  // Persist preferences.
  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) return
    try {
      window.localStorage.setItem(
        `${storageKeyBase}:pdfExport:v1`,
        JSON.stringify({
          scope,
          layout,
          orientation,
          includeHero,
          includeDescription,
          includeNotesAddendum,
        }),
      )
    } catch {
      // ignore
    }
  }, [includeDescription, includeHero, includeNotesAddendum, layout, open, orientation, scope, storageKeyBase])

  const shots = scope === "selected" ? shotsSelected : shotsAll

  const fileName = useMemo(() => {
    const base = safeFileName(projectName || "Project")
    const suffix = scope === "selected" ? "Selected Shots" : "Shots"
    return `${base} — ${suffix}.pdf`
  }, [projectName, scope])

  const buildDoc = async () => {
    const rows = await buildShotsPdfRows({
      shots,
      includeHero,
      talentNameById,
      locationNameById,
    })

    const generatedAt = formatGeneratedAt()
    const title = scope === "selected" ? "Selected shots" : "Shots"

    return (
      <ShotsListPdfDocument
        projectName={projectName || "Project"}
        title={title}
        generatedAt={generatedAt}
        orientation={orientation}
        layout={layout}
        rows={rows}
        includeHero={includeHero}
        includeDescription={includeDescription}
        includeNotesAddendum={includeNotesAddendum}
      />
    )
  }

  const doExport = async () => {
    if (shots.length === 0) return
    setExporting(true)
    try {
      const doc = await buildDoc()
      const blob = await pdf(doc).toBlob()
      downloadBlob(blob, fileName)
      toast.success("PDF exported")
      onOpenChange(false)
    } catch (err) {
      console.error("[ShotsPdfExportDialog] Export failed:", err)
      toast.error("Failed to export PDF")
    } finally {
      setExporting(false)
    }
  }

  // Preview generation (on-demand; regenerates when options change).
  useEffect(() => {
    if (!open) return
    if (!previewOpen) return

    let active = true
    const t = window.setTimeout(() => {
      setPreviewLoading(true)
      void buildDoc()
        .then((doc) => pdf(doc).toBlob())
        .then((blob) => {
          if (!active) return
          const url = URL.createObjectURL(blob)
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return url
          })
        })
        .catch((err) => {
          if (!active) return
          console.error("[ShotsPdfExportDialog] Preview failed:", err)
          toast.error("Failed to render preview")
        })
        .finally(() => {
          if (!active) return
          setPreviewLoading(false)
        })
    }, 200)

    return () => {
      active = false
      window.clearTimeout(t)
    }
  }, [
    includeDescription,
    includeHero,
    includeNotesAddendum,
    layout,
    open,
    orientation,
    previewOpen,
    scope,
    shots,
    talentNameById,
    locationNameById,
    projectName,
  ])

  useEffect(() => {
    if (!open) return
    if (previewOpen) return
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }, [open, previewOpen, previewUrl])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setPreviewOpen(false)
        onOpenChange(next)
      }}
    >
      <DialogContent className={previewOpen ? "max-w-5xl" : "max-w-lg"}>
        <DialogHeader>
          <DialogTitle>Export PDF</DialogTitle>
          <DialogDescription className="sr-only">
            Export project shots as a PDF.
          </DialogDescription>
        </DialogHeader>

        <div className={previewOpen ? "grid gap-6 md:grid-cols-[360px_1fr]" : "flex flex-col gap-4"}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="project">All project shots ({shotsAll.length})</SelectItem>
                  <SelectItem value="selected" disabled={!hasSelection}>
                    Selected shots ({shotsSelected.length})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Layout</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as ShotsPdfLayout)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="table">Table</SelectItem>
                    <SelectItem value="cards">Cards</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Orientation</Label>
                <Select value={orientation} onValueChange={(v) => setOrientation(v as ShotsPdfOrientation)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>Include hero images</span>
                <Checkbox checked={includeHero} onCheckedChange={(v) => v !== "indeterminate" && setIncludeHero(v)} />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>Include description</span>
                <Checkbox
                  checked={includeDescription}
                  onCheckedChange={(v) => v !== "indeterminate" && setIncludeDescription(v)}
                />
              </label>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>Include notes addendum</span>
                <Checkbox
                  checked={includeNotesAddendum}
                  onCheckedChange={(v) => v !== "indeterminate" && setIncludeNotesAddendum(v)}
                />
              </label>
            </div>

            <Separator />

            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewOpen((v) => !v)}
                disabled={exporting}
              >
                {previewOpen ? "Hide preview" : "Show preview"}
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
                  Cancel
                </Button>
                <Button onClick={doExport} disabled={exporting || shots.length === 0}>
                  {exporting ? "Exporting…" : "Download PDF"}
                </Button>
              </div>
            </div>
          </div>

          {previewOpen && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
                <div className="text-xs text-[var(--color-text-muted)]">{fileName}</div>
                <div className="text-xs text-[var(--color-text-muted)]">
                  {previewLoading ? "Rendering…" : "Preview"}
                </div>
              </div>
              <div className="h-[70vh] w-full">
                {previewUrl ? (
                  <iframe
                    title="PDF preview"
                    src={previewUrl}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-muted)]">
                    {previewLoading ? "Rendering preview…" : "Preview will appear here."}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
