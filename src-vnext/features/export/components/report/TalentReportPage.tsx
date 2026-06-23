import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useExportData } from "../../hooks/useExportData"
import { useExportReports } from "../../hooks/useExportReports"
import {
  collectTalentImageCandidates,
  deriveTalentModel,
} from "../../lib/report/talentModel"
import { resolveReportImages } from "../../lib/report/reportImages"
import {
  DEFAULT_TALENT_CONFIG,
  type TalentConfig,
} from "../../lib/report/talentTypes"
import { TalentReportView } from "./TalentReportView"

// Integration layer: live export data -> resolved talent model -> image sidecar ->
// TalentReportView. The model + imageMap feed both the screen render and the PDF,
// so they can't drift. Mounted only behind the featureTalentReport flag (route
// gate). Mirrors ProductInfoReportPage.

export default function TalentReportPage() {
  const data = useExportData()
  const { id: projectId } = useParams<{ id: string }>()
  const { clientId } = useAuth()
  const [searchParams] = useSearchParams()
  const reportId = searchParams.get("reportId")
  const { loadReport, saveReportConfig } = useExportReports(clientId, projectId)

  const [config, setConfig] = useState<TalentConfig>(DEFAULT_TALENT_CONFIG)
  const [imageMap, setImageMap] = useState<ReadonlyMap<string, string>>(new Map())
  const [imagesLoading, setImagesLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The reportId that has finished hydrating. Edits made while a report is still
  // loading must not persist — they'd save the outgoing report's config onto it.
  const hydratedReportIdRef = useRef<string | null>(null)
  // The image candidate set last resolved — re-derivations that don't change it
  // (a scope/group-by toggle that keeps the same headshots) skip the resolve so
  // the loading overlay doesn't flash.
  const lastImageKeyRef = useRef<string | null>(null)
  // False after unmount — gates async image setState so a navigate-away mid-resolve
  // can't update a dead component. Unmount-scoped (NOT per-run), so a same-key
  // re-run mid-resolve still lets the in-flight request clear the loading overlay.
  const mountedRef = useRef(true)

  // Hydrate config from a saved talent doc when ?reportId= is present, else reset
  // to defaults. Switching reports (or clearing reportId) also cancels any pending
  // write from the previous report. Default-merge so an older blob parses.
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    hydratedReportIdRef.current = null
    if (!reportId) {
      setConfig(DEFAULT_TALENT_CONFIG)
      return
    }
    let cancelled = false
    void loadReport(reportId)
      .then((full) => {
        if (cancelled) return
        if (!full) return // doc not found (deleted) — keep defaults, nothing to persist
        // Cross-type guard: a pasted cross-type reportId must not clobber that doc's config.
        if (full.reportType !== "talent") return
        const loaded = full.config as TalentConfig | undefined
        setConfig(loaded ? { ...DEFAULT_TALENT_CONFIG, ...loaded } : DEFAULT_TALENT_CONFIG)
        hydratedReportIdRef.current = reportId
      })
      .catch(() => {
        if (!cancelled) toast.error("Couldn't load the report — changes won't be saved")
      })
    return () => {
      cancelled = true
    }
  }, [reportId, loadReport])

  // User edits persist (debounced) only when editing a saved report that has
  // hydrated. Hydration uses setConfig directly, so it never triggers a write-back.
  const handleConfigChange = useCallback(
    (next: TalentConfig) => {
      setConfig(next)
      if (!reportId || hydratedReportIdRef.current !== reportId) return
      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(() => {
        void saveReportConfig(reportId, next).catch(() => {
          /* offline cache retries */
        })
      }, 800)
    },
    [reportId, saveReportConfig],
  )

  // Cancel a pending config write + block async setState if we unmount.
  useEffect(
    () => () => {
      mountedRef.current = false
      if (persistTimer.current) clearTimeout(persistTimer.current)
    },
    [],
  )

  const model = useMemo(() => deriveTalentModel(data, config), [data, config])

  // Resolve every image candidate to a data URL once the model is known.
  // resolvePdfImageSrc caches module-side, so re-resolving on config change is cheap.
  useEffect(() => {
    const candidates = collectTalentImageCandidates(model)
    const key = candidates.join("\n")
    if (key === lastImageKeyRef.current) return // image set unchanged — no re-resolve
    lastImageKeyRef.current = key
    if (candidates.length === 0) {
      setImageMap(new Map())
      setImagesLoading(false)
      return
    }
    setImagesLoading(true)
    // Apply/clear only while this key is still the latest request, so a same-key
    // re-run (groupBy/exclude toggle) mid-resolve can't strand imagesLoading at true.
    resolveReportImages(candidates)
      .then((resolved) => {
        if (mountedRef.current && lastImageKeyRef.current === key) {
          setImageMap(resolved)
          setImagesLoading(false)
        }
      })
      .catch(() => {
        // per-image failures already drop out of resolveReportImages
        if (mountedRef.current && lastImageKeyRef.current === key) setImagesLoading(false)
      })
  }, [model])

  const handleExportPdf = useCallback(() => {
    setExporting(true)
    // Lazy-import so @react-pdf (and its heavy deps) load only on export click,
    // keeping them out of the report route's eager chunk.
    void (async () => {
      const { generateTalentPdf } = await import("../../lib/report/reportPdfTalent")
      await generateTalentPdf(model, imageMap, `${model.project.name} — Talent.pdf`)
    })()
      .catch(() => toast.error("Couldn't export the PDF"))
      .finally(() => {
        setExporting(false)
      })
  }, [model, imageMap])

  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        Loading talent…
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {imagesLoading && (
        <div
          role="status"
          className="absolute right-4 top-4 z-20 rounded bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-text-secondary)] ring-1 ring-[var(--color-border)]"
        >
          Loading images…
        </div>
      )}
      <TalentReportView
        model={model}
        imageMap={imageMap}
        config={config}
        onConfigChange={handleConfigChange}
        onExportPdf={handleExportPdf}
        exporting={exporting}
        imagesLoading={imagesLoading}
      />
    </div>
  )
}
