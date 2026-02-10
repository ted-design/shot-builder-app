import { useCallback, useEffect, useMemo, useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Checkbox } from "@/ui/checkbox"
import { Separator } from "@/ui/separator"
import { toast } from "sonner"
import { buildShotsPdfRows } from "@/features/shots/lib/buildShotsPdfRows"
import {
  type ContactCardsPerPage,
  DEFAULT_RUN_SHEET_COLUMNS,
  ShotsListPdfDocument,
  type AddendumMode,
  type ContactSheetDensity,
  type RunSheetColumns,
  type RunSheetDensity,
  type ShotsPdfLayout,
  type ShotsPdfOrientation,
} from "@/features/shots/lib/shotsPdfTemplates"
import type { Shot } from "@/shared/types"
import type { ShotsPdfRow } from "@/features/shots/lib/shotsPdfTemplates"

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

type HeroImageReport = {
  readonly requested: number
  readonly resolved: number
  readonly missing: number
}

type RunSheetPreset = "producer_review" | "wardrobe_run" | "talent_blocking" | "custom"

type RunSheetPresetConfig = {
  readonly columns: RunSheetColumns
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
  readonly addendumMode: AddendumMode
}

const RUN_SHEET_PRESET_CONFIG: Record<Exclude<RunSheetPreset, "custom">, RunSheetPresetConfig> = {
  producer_review: {
    columns: DEFAULT_RUN_SHEET_COLUMNS,
    includeDescription: true,
    includeNotesAddendum: true,
    addendumMode: "summary",
  },
  wardrobe_run: {
    columns: {
      hero: true,
      date: false,
      location: false,
      talent: false,
      products: true,
      status: true,
      addendum: true,
    },
    includeDescription: false,
    includeNotesAddendum: true,
    addendumMode: "summary",
  },
  talent_blocking: {
    columns: {
      hero: true,
      date: true,
      location: true,
      talent: true,
      products: false,
      status: true,
      addendum: false,
    },
    includeDescription: true,
    includeNotesAddendum: false,
    addendumMode: "summary",
  },
}

function recommendedContactDensity(orientation: ShotsPdfOrientation): ContactSheetDensity {
  return orientation === "landscape" ? "compact" : "compact"
}

function recommendedHideEmptyMeta(orientation: ShotsPdfOrientation): boolean {
  return orientation === "landscape"
}

function contactDensityGuidance(density: ContactSheetDensity): string {
  if (density === "standard") return "Readability-first profile."
  if (density === "compact") return "Balanced profile for most producer workflows."
  return "High-density profile for index/scan packets."
}

function runSheetPresetGuidance(preset: RunSheetPreset): string {
  if (preset === "producer_review") return "Balanced cross-team run sheet (recommended default)."
  if (preset === "wardrobe_run") return "Product-first layout for pulls and prep."
  if (preset === "talent_blocking") return "Talent/location emphasis for blocking and movement."
  return "Custom manual configuration."
}

function runSheetDensityGuidance(density: RunSheetDensity): string {
  if (density === "compact") return "More rows per page with tighter spacing."
  return "Larger row spacing for easier read-through."
}

function visibleRunSheetColumns(includeHero: boolean, columns: RunSheetColumns): number {
  return (
    1 +
    (includeHero && columns.hero ? 1 : 0) +
    (columns.date ? 1 : 0) +
    (columns.location ? 1 : 0) +
    (columns.talent ? 1 : 0) +
    (columns.products ? 1 : 0) +
    (columns.status ? 1 : 0)
  )
}

function contactDensityBasePages(
  orientation: ShotsPdfOrientation,
  density: ContactSheetDensity,
): number {
  if (orientation === "landscape") {
    if (density === "standard") return 4
    if (density === "compact") return 6
    return 8
  }
  if (density === "standard") return 3
  if (density === "compact") return 4
  return 8
}

function summarizeHeroImageReport(rows: readonly ShotsPdfRow[]): HeroImageReport {
  const requested = rows.filter((row) => row.heroImageRequested).length
  const resolved = rows.filter((row) => row.heroImageRequested && !!row.heroImageUrl).length
  const missing = Math.max(0, requested - resolved)
  return { requested, resolved, missing }
}

function columnsEqual(a: RunSheetColumns, b: RunSheetColumns): boolean {
  return (
    a.hero === b.hero &&
    a.date === b.date &&
    a.location === b.location &&
    a.talent === b.talent &&
    a.products === b.products &&
    a.status === b.status &&
    a.addendum === b.addendum
  )
}

function timestampDependencyKey(value: unknown): string {
  if (!value || typeof value !== "object") return ""
  const candidate = value as {
    readonly toMillis?: () => number
    readonly seconds?: number
    readonly nanoseconds?: number
  }

  if (typeof candidate.toMillis === "function") {
    try {
      return String(candidate.toMillis())
    } catch {
      // fall through
    }
  }

  if (typeof candidate.seconds === "number") {
    return `${candidate.seconds}:${typeof candidate.nanoseconds === "number" ? candidate.nanoseconds : 0}`
  }

  return ""
}

function estimateShotsPdfPages({
  shotsCount,
  layout,
  orientation,
  contactDensity,
  contactCardsPerPage,
  includeHero,
  hideEmptyMeta,
  runSheetColumns,
  runSheetDensity,
  includeDescription,
  includeNotesAddendum,
}: {
  readonly shotsCount: number
  readonly layout: ShotsPdfLayout
  readonly orientation: ShotsPdfOrientation
  readonly contactDensity: ContactSheetDensity
  readonly contactCardsPerPage: ContactCardsPerPage
  readonly includeHero: boolean
  readonly hideEmptyMeta: boolean
  readonly runSheetColumns: RunSheetColumns
  readonly runSheetDensity: RunSheetDensity
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
}): number {
  if (shotsCount <= 0) return 0

  if (layout === "cards") {
    let perPage =
      contactCardsPerPage === "auto"
        ? contactDensityBasePages(orientation, contactDensity)
        : Number(contactCardsPerPage)

    if (contactCardsPerPage === "auto") {
      if (!includeHero) perPage *= 1.12
      if (hideEmptyMeta) perPage *= 1.08
    }
    return Math.max(1, Math.ceil(shotsCount / perPage))
  }

  const visibleCols = visibleRunSheetColumns(includeHero, runSheetColumns)

  let perPage = orientation === "landscape" ? 5.2 : 9.0
  if (runSheetDensity === "compact") perPage *= 1.24
  if (visibleCols <= 4) perPage *= 1.12
  if (!includeDescription) perPage *= 1.1
  if (includeNotesAddendum && runSheetColumns.addendum) {
    perPage *= orientation === "landscape" ? 0.88 : 0.78
  }

  return Math.max(1, Math.ceil(shotsCount / perPage))
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
  const [layout, setLayout] = useState<ShotsPdfLayout>("cards")
  const [orientation, setOrientation] = useState<ShotsPdfOrientation>("portrait")
  const [includeHero, setIncludeHero] = useState(true)
  const [includeDescription, setIncludeDescription] = useState(false)
  const [includeNotesAddendum, setIncludeNotesAddendum] = useState(true)
  const [addendumMode, setAddendumMode] = useState<AddendumMode>("full")
  const [contactDensity, setContactDensity] = useState<ContactSheetDensity>("standard")
  const [contactCardsPerPage, setContactCardsPerPage] = useState<ContactCardsPerPage>("auto")
  const [hideEmptyMeta, setHideEmptyMeta] = useState(false)
  const [runSheetColumns, setRunSheetColumns] = useState<RunSheetColumns>(DEFAULT_RUN_SHEET_COLUMNS)
  const [runSheetPreset, setRunSheetPreset] = useState<RunSheetPreset>("producer_review")
  const [runSheetDensity, setRunSheetDensity] = useState<RunSheetDensity>("comfortable")

  const [exporting, setExporting] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [heroReport, setHeroReport] = useState<HeroImageReport | null>(null)
  const [heroReportLoading, setHeroReportLoading] = useState(false)

  const applyRunSheetPreset = useCallback((preset: Exclude<RunSheetPreset, "custom">) => {
    const config = RUN_SHEET_PRESET_CONFIG[preset]
    setRunSheetPreset(preset)
    setRunSheetColumns(config.columns)
    setIncludeDescription(config.includeDescription)
    setIncludeNotesAddendum(config.includeNotesAddendum)
    setAddendumMode(config.addendumMode)
    setRunSheetDensity("comfortable")
  }, [])

  const applyRecommendedDefaults = useCallback((
    nextLayout: ShotsPdfLayout,
    nextOrientation: ShotsPdfOrientation,
  ) => {
    if (nextLayout === "cards") {
      setContactDensity(recommendedContactDensity(nextOrientation))
      setContactCardsPerPage("auto")
      setHideEmptyMeta(recommendedHideEmptyMeta(nextOrientation))
      setIncludeDescription(true)
      setIncludeNotesAddendum(true)
      setAddendumMode("summary")
      return
    }

    applyRunSheetPreset("producer_review")
  }, [applyRunSheetPreset])

  // Load preferences on open.
  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) {
      setScope(hasSelection ? "selected" : "project")
      applyRecommendedDefaults(layout, orientation)
      return
    }
    try {
      const raw =
        window.localStorage.getItem(`${storageKeyBase}:pdfExport:v2`) ??
        window.localStorage.getItem(`${storageKeyBase}:pdfExport:v1`)
      if (!raw) {
        applyRecommendedDefaults(layout, orientation)
        return
      }
      const parsed = JSON.parse(raw) as Partial<{
        scope: ExportScope
        layout: ShotsPdfLayout
        orientation: ShotsPdfOrientation
        includeHero: boolean
        includeDescription: boolean
        includeNotesAddendum: boolean
        addendumMode: AddendumMode
        contactDensity: ContactSheetDensity
        contactCardsPerPage: ContactCardsPerPage
        hideEmptyMeta: boolean
        runSheetColumns: Partial<RunSheetColumns>
        runSheetPreset: RunSheetPreset
        runSheetDensity: RunSheetDensity
      }>
      if (parsed.scope === "project" || parsed.scope === "selected") {
        setScope(parsed.scope === "selected" && hasSelection ? "selected" : "project")
      }
      if (parsed.layout === "table" || parsed.layout === "cards") setLayout(parsed.layout)
      if (parsed.orientation === "portrait" || parsed.orientation === "landscape") setOrientation(parsed.orientation)
      if (typeof parsed.includeHero === "boolean") setIncludeHero(parsed.includeHero)
      if (typeof parsed.includeDescription === "boolean") setIncludeDescription(parsed.includeDescription)
      if (typeof parsed.includeNotesAddendum === "boolean") setIncludeNotesAddendum(parsed.includeNotesAddendum)
      if (parsed.addendumMode === "off") {
        setIncludeNotesAddendum(false)
      } else if (parsed.addendumMode === "full" || parsed.addendumMode === "summary") {
        setAddendumMode(parsed.addendumMode)
      }
      if (
        parsed.contactDensity === "standard" ||
        parsed.contactDensity === "compact" ||
        parsed.contactDensity === "max"
      ) {
        setContactDensity(parsed.contactDensity)
      }
      if (
        parsed.contactCardsPerPage === "auto" ||
        parsed.contactCardsPerPage === "4" ||
        parsed.contactCardsPerPage === "6" ||
        parsed.contactCardsPerPage === "8"
      ) {
        setContactCardsPerPage(parsed.contactCardsPerPage)
      }
      if (typeof parsed.hideEmptyMeta === "boolean") {
        setHideEmptyMeta(parsed.hideEmptyMeta)
      }
      if (parsed.runSheetColumns) {
        setRunSheetColumns({
          hero:
            typeof parsed.runSheetColumns.hero === "boolean"
              ? parsed.runSheetColumns.hero
              : DEFAULT_RUN_SHEET_COLUMNS.hero,
          date:
            typeof parsed.runSheetColumns.date === "boolean"
              ? parsed.runSheetColumns.date
              : DEFAULT_RUN_SHEET_COLUMNS.date,
          location:
            typeof parsed.runSheetColumns.location === "boolean"
              ? parsed.runSheetColumns.location
              : DEFAULT_RUN_SHEET_COLUMNS.location,
          talent:
            typeof parsed.runSheetColumns.talent === "boolean"
              ? parsed.runSheetColumns.talent
              : DEFAULT_RUN_SHEET_COLUMNS.talent,
          products:
            typeof parsed.runSheetColumns.products === "boolean"
              ? parsed.runSheetColumns.products
              : DEFAULT_RUN_SHEET_COLUMNS.products,
          status:
            typeof parsed.runSheetColumns.status === "boolean"
              ? parsed.runSheetColumns.status
              : DEFAULT_RUN_SHEET_COLUMNS.status,
          addendum:
            typeof parsed.runSheetColumns.addendum === "boolean"
              ? parsed.runSheetColumns.addendum
              : DEFAULT_RUN_SHEET_COLUMNS.addendum,
        })
      }
      if (
        parsed.runSheetPreset === "producer_review" ||
        parsed.runSheetPreset === "wardrobe_run" ||
        parsed.runSheetPreset === "talent_blocking" ||
        parsed.runSheetPreset === "custom"
      ) {
        setRunSheetPreset(parsed.runSheetPreset)
      }
      if (parsed.runSheetDensity === "comfortable" || parsed.runSheetDensity === "compact") {
        setRunSheetDensity(parsed.runSheetDensity)
      }
    } catch {
      // ignore
    }
  }, [applyRecommendedDefaults, hasSelection, open, storageKeyBase])

  // Persist preferences.
  useEffect(() => {
    if (!open) return
    if (!storageKeyBase) return
    try {
      window.localStorage.setItem(
        `${storageKeyBase}:pdfExport:v2`,
        JSON.stringify({
          scope,
          layout,
          orientation,
          includeHero,
          includeDescription,
          includeNotesAddendum,
          addendumMode,
          contactDensity,
          contactCardsPerPage,
          hideEmptyMeta,
          runSheetColumns,
          runSheetPreset,
          runSheetDensity,
        }),
      )
    } catch {
      // ignore
    }
  }, [
    addendumMode,
    contactDensity,
    contactCardsPerPage,
    includeDescription,
    includeHero,
    includeNotesAddendum,
    layout,
    hideEmptyMeta,
    open,
    orientation,
    runSheetColumns,
    runSheetPreset,
    runSheetDensity,
    scope,
    storageKeyBase,
  ])

  useEffect(() => {
    const matched = (Object.entries(RUN_SHEET_PRESET_CONFIG) as Array<
      [Exclude<RunSheetPreset, "custom">, RunSheetPresetConfig]
    >).find(
      ([, config]) =>
        columnsEqual(runSheetColumns, config.columns) &&
        includeDescription === config.includeDescription &&
        includeNotesAddendum === config.includeNotesAddendum &&
        addendumMode === config.addendumMode,
    )
    setRunSheetPreset(matched ? matched[0] : "custom")
  }, [addendumMode, includeDescription, includeNotesAddendum, runSheetColumns])

  const shots = scope === "selected" ? shotsSelected : shotsAll
  const shotsDependencyKey = useMemo(
    () =>
      shots
        .map(
          (shot) =>
            [
              shot.id,
              shot.sortOrder,
              shot.status,
              shot.heroImage?.path ?? "",
              shot.locationId ?? shot.locationName ?? "",
              shot.talent.length,
              shot.products.length,
              timestampDependencyKey(shot.updatedAt),
            ].join(":"),
        )
        .join("|"),
    [shots],
  )
  const estimatedPages = useMemo(
    () =>
      estimateShotsPdfPages({
        shotsCount: shots.length,
        layout,
        orientation,
        contactDensity,
        contactCardsPerPage,
        includeHero,
        hideEmptyMeta,
        runSheetColumns,
        runSheetDensity,
        includeDescription,
        includeNotesAddendum,
      }),
    [
      contactDensity,
      contactCardsPerPage,
      hideEmptyMeta,
      includeDescription,
      includeHero,
      includeNotesAddendum,
      layout,
      orientation,
      runSheetColumns,
      runSheetDensity,
      shots.length,
    ],
  )
  const runSheetVisibleColumnCount = useMemo(
    () => visibleRunSheetColumns(includeHero, runSheetColumns),
    [includeHero, runSheetColumns],
  )
  const runSheetReadabilityWarnings = useMemo(() => {
    if (layout !== "table") return [] as string[]
    const warnings: string[] = []

    if (orientation === "portrait" && runSheetVisibleColumnCount >= 6 && runSheetDensity !== "compact") {
      warnings.push("Portrait + 6+ columns is dense. Switch row density to Compact or disable 1-2 columns.")
    }
    if (
      orientation === "portrait" &&
      runSheetVisibleColumnCount >= 6 &&
      includeNotesAddendum &&
      runSheetColumns.addendum &&
      addendumMode === "full"
    ) {
      warnings.push("Full addendum with many portrait columns can reduce legibility. Use Summary or Landscape.")
    }
    if (runSheetVisibleColumnCount <= 4 && runSheetDensity === "compact") {
      warnings.push("Compact row density may be unnecessarily tight for this column set.")
    }

    return warnings
  }, [
    addendumMode,
    includeNotesAddendum,
    layout,
    orientation,
    runSheetColumns.addendum,
    runSheetDensity,
    runSheetVisibleColumnCount,
  ])

  const fileName = useMemo(() => {
    const base = safeFileName(projectName || "Project")
    const suffix = scope === "selected" ? "Selected Shots" : "Shots"
    return `${base} — ${suffix}.pdf`
  }, [projectName, scope])

  const buildDoc = async (): Promise<{ readonly doc: JSX.Element; readonly rows: readonly ShotsPdfRow[] }> => {
    const rows = await buildShotsPdfRows({
      shots,
      includeHero,
      talentNameById,
      locationNameById,
    })

    const generatedAt = formatGeneratedAt()
    const title = scope === "selected" ? "Selected shots" : "Shots"

    const doc = (
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
        addendumMode={addendumMode}
        contactDensity={contactDensity}
        contactCardsPerPage={contactCardsPerPage}
        hideEmptyMeta={hideEmptyMeta}
        runSheetColumns={runSheetColumns}
        runSheetDensity={runSheetDensity}
      />
    )
    return { doc, rows }
  }

  const doExport = async () => {
    if (shots.length === 0) return
    setExporting(true)
    try {
      const { doc, rows } = await buildDoc()
      const blob = await pdf(doc).toBlob()
      downloadBlob(blob, fileName)
      const report = includeHero ? summarizeHeroImageReport(rows) : null
      toast.success("PDF exported", {
        description:
          includeHero && report && report.requested > 0 && report.missing > 0
            ? `${report.missing} hero image${report.missing === 1 ? "" : "s"} could not be embedded and were marked as unavailable.`
            : undefined,
      })
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
        .then(({ doc }) => pdf(doc).toBlob())
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
    addendumMode,
    contactDensity,
    contactCardsPerPage,
    hideEmptyMeta,
    layout,
    open,
    orientation,
    previewOpen,
    runSheetColumns,
    runSheetDensity,
    scope,
    shotsDependencyKey,
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

  // Preflight image availability report.
  useEffect(() => {
    if (!open) return
    if (!includeHero) {
      setHeroReport(null)
      setHeroReportLoading(false)
      return
    }

    let active = true
    const t = window.setTimeout(() => {
      setHeroReportLoading(true)
      void buildShotsPdfRows({
        shots,
        includeHero: true,
        talentNameById,
        locationNameById,
      })
        .then((rows) => {
          if (!active) return
          setHeroReport(summarizeHeroImageReport(rows))
        })
        .catch((err) => {
          if (!active) return
          console.error("[ShotsPdfExportDialog] Hero preflight failed:", err)
          setHeroReport(null)
        })
        .finally(() => {
          if (!active) return
          setHeroReportLoading(false)
        })
    }, 150)

    return () => {
      active = false
      window.clearTimeout(t)
    }
  }, [includeHero, locationNameById, open, shotsDependencyKey, talentNameById])

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
                <Select
                  value={layout}
                  onValueChange={(v) => {
                    const nextLayout = v as ShotsPdfLayout
                    setLayout(nextLayout)
                    applyRecommendedDefaults(nextLayout, orientation)
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cards">Contact sheet</SelectItem>
                    <SelectItem value="table">Run sheet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Orientation</Label>
                <Select
                  value={orientation}
                  onValueChange={(v) => {
                    const nextOrientation = v as ShotsPdfOrientation
                    setOrientation(nextOrientation)
                    applyRecommendedDefaults(layout, nextOrientation)
                  }}
                >
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
            <p className="text-xs text-[var(--color-text-muted)]">
              Defaults auto-adjust to a recommended profile when layout or orientation changes.
            </p>

            <Separator />

            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-2 text-sm">
                <span>Include hero images</span>
                <Checkbox checked={includeHero} onCheckedChange={(v) => v !== "indeterminate" && setIncludeHero(v)} />
              </label>
              {includeHero && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  {heroReportLoading
                    ? "Checking hero image availability…"
                    : heroReport && heroReport.requested > 0
                      ? heroReport.missing > 0
                        ? `${heroReport.resolved}/${heroReport.requested} hero images ready. ${heroReport.missing} will be marked as unavailable in the PDF.`
                        : `${heroReport.resolved}/${heroReport.requested} hero images ready for export.`
                      : "No hero images detected in this scope."}
                </p>
              )}
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

              {includeNotesAddendum && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Addendum detail</Label>
                  <Select value={addendumMode} onValueChange={(v) => setAddendumMode(v as AddendumMode)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Full text</SelectItem>
                      <SelectItem value="summary">Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {layout === "cards" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Contact sheet density</Label>
                  <Select value={contactDensity} onValueChange={(v) => setContactDensity(v as ContactSheetDensity)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                      <SelectItem value="max">Maximum</SelectItem>
                    </SelectContent>
                  </Select>
                  <Label className="mt-1 text-xs">Cards per page</Label>
                  <Select value={contactCardsPerPage} onValueChange={(v) => setContactCardsPerPage(v as ContactCardsPerPage)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (by density)</SelectItem>
                      <SelectItem value="4">4 cards/page</SelectItem>
                      <SelectItem value="6">6 cards/page</SelectItem>
                      <SelectItem value="8">8 cards/page</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {contactDensityGuidance(contactDensity)}{" "}
                    {contactCardsPerPage === "auto"
                      ? `Auto target: ${orientation === "landscape" ? "4 / 6 / 8 cards" : "3 / 4 / 8 cards"} (Standard/Compact/Maximum).`
                      : `Manual target: ${contactCardsPerPage} cards per page.`}
                  </p>
                  <label className="mt-1 flex items-center justify-between gap-2 text-sm">
                    <span>Hide empty date/location</span>
                    <Checkbox
                      checked={hideEmptyMeta}
                      onCheckedChange={(v) => v !== "indeterminate" && setHideEmptyMeta(v)}
                    />
                  </label>
                </div>
              )}

              {layout === "table" && (
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">Run sheet preset</Label>
                  <Select
                    value={runSheetPreset}
                    onValueChange={(v) => {
                      const preset = v as RunSheetPreset
                      if (preset === "custom") return
                      applyRunSheetPreset(preset)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="producer_review">Producer review</SelectItem>
                      <SelectItem value="wardrobe_run">Wardrobe run</SelectItem>
                      <SelectItem value="talent_blocking">Talent blocking</SelectItem>
                      <SelectItem value="custom">Custom (manual)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Presets apply fast defaults for columns and note detail. You can still tune columns manually below.
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {runSheetPresetGuidance(runSheetPreset)}
                  </p>
                  <Label className="mt-1 text-xs">Run sheet row density</Label>
                  <Select value={runSheetDensity} onValueChange={(v) => setRunSheetDensity(v as RunSheetDensity)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comfortable">Comfortable</SelectItem>
                      <SelectItem value="compact">Compact</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {runSheetDensityGuidance(runSheetDensity)} Visible columns: {runSheetVisibleColumnCount}.
                  </p>
                  {runSheetReadabilityWarnings.length > 0 ? (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-2 py-2 text-xs text-amber-900">
                      {runSheetReadabilityWarnings.map((warning) => (
                        <p key={warning}>{warning}</p>
                      ))}
                    </div>
                  ) : null}

                  <Label className="text-xs">Run sheet columns</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Hero</span>
                      <Checkbox
                        checked={runSheetColumns.hero}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, hero: v }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Date</span>
                      <Checkbox
                        checked={runSheetColumns.date}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, date: v }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Location</span>
                      <Checkbox
                        checked={runSheetColumns.location}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, location: v }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Talent</span>
                      <Checkbox
                        checked={runSheetColumns.talent}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, talent: v }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Products</span>
                      <Checkbox
                        checked={runSheetColumns.products}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, products: v }))
                        }
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Status</span>
                      <Checkbox
                        checked={runSheetColumns.status}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, status: v }))
                        }
                      />
                    </label>
                    <label className="col-span-2 flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-2 py-1.5">
                      <span>Addendum section</span>
                      <Checkbox
                        checked={runSheetColumns.addendum}
                        onCheckedChange={(v) =>
                          v !== "indeterminate" &&
                          setRunSheetColumns((prev) => ({ ...prev, addendum: v }))
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <Separator />
            <p className="text-xs text-[var(--color-text-muted)]">
              Estimated pages: {estimatedPages > 0 ? `~${estimatedPages}` : "0"} (calibrated to recent exports; actual may vary by content length)
            </p>

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
