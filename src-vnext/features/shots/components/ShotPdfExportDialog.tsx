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
import { ShotDetailPdfDocument, type ShotsPdfOrientation } from "@/features/shots/lib/shotsPdfTemplates"
import type { Shot } from "@/shared/types"

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

export function ShotPdfExportDialog({
  open,
  onOpenChange,
  projectName,
  shot,
  talentNameById,
  locationNameById,
  storageKeyBase,
}: {
  readonly open: boolean
  readonly onOpenChange: (next: boolean) => void
  readonly projectName: string
  readonly shot: Shot
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly storageKeyBase?: string | null
}) {
  const [orientation, setOrientation] = useState<ShotsPdfOrientation>("portrait")
  const [includeHero, setIncludeHero] = useState(true)
  const [includeDescription, setIncludeDescription] = useState(true)
  const [includeNotesAddendum, setIncludeNotesAddendum] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Load prefs on open.
  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) return
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:shotPdfExport:v1`)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        orientation: ShotsPdfOrientation
        includeHero: boolean
        includeDescription: boolean
        includeNotesAddendum: boolean
      }>
      if (parsed.orientation === "portrait" || parsed.orientation === "landscape") setOrientation(parsed.orientation)
      if (typeof parsed.includeHero === "boolean") setIncludeHero(parsed.includeHero)
      if (typeof parsed.includeDescription === "boolean") setIncludeDescription(parsed.includeDescription)
      if (typeof parsed.includeNotesAddendum === "boolean") setIncludeNotesAddendum(parsed.includeNotesAddendum)
    } catch {
      // ignore
    }
  }, [open, storageKeyBase])

  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) return
    try {
      window.localStorage.setItem(
        `${storageKeyBase}:shotPdfExport:v1`,
        JSON.stringify({
          orientation,
          includeHero,
          includeDescription,
          includeNotesAddendum,
        }),
      )
    } catch {
      // ignore
    }
  }, [includeDescription, includeHero, includeNotesAddendum, open, orientation, storageKeyBase])

  const fileName = useMemo(() => {
    const base = safeFileName(projectName || "Project")
    const shotName = safeFileName(shot.title || "Shot")
    const suffix = shot.shotNumber ? `#${shot.shotNumber}` : "Shot"
    return `${base} — ${suffix} — ${shotName}.pdf`
  }, [projectName, shot.shotNumber, shot.title])

  const doExport = async () => {
    setExporting(true)
    try {
      const [row] = await buildShotsPdfRows({
        shots: [shot],
        includeHero,
        talentNameById,
        locationNameById,
      })
      if (!row) throw new Error("Missing row")

      const generatedAt = formatGeneratedAt()
      const title = row.shotNumber ? `Shot #${row.shotNumber}` : "Shot"

      const doc = (
        <ShotDetailPdfDocument
          projectName={projectName || "Project"}
          title={title}
          generatedAt={generatedAt}
          orientation={orientation}
          row={row}
          includeHero={includeHero}
          includeDescription={includeDescription}
          includeNotesAddendum={includeNotesAddendum}
        />
      )
      const blob = await pdf(doc).toBlob()
      downloadBlob(blob, fileName)
      toast.success("PDF exported")
      onOpenChange(false)
    } catch (err) {
      console.error("[ShotPdfExportDialog] Export failed:", err)
      toast.error("Failed to export PDF")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export shot PDF</DialogTitle>
          <DialogDescription className="sr-only">
            Export this shot as a PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
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

          <Separator />

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>Include hero image</span>
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

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={doExport} disabled={exporting}>
              {exporting ? "Exporting…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
