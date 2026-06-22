import { useCallback, useEffect, useMemo, useState } from "react"
import { useExportData } from "../../hooks/useExportData"
import { deriveShotReportModel } from "../../lib/report/reportModel"
import {
  collectReportImageCandidates,
  resolveReportImages,
} from "../../lib/report/reportImages"
import { DEFAULT_REPORT_CONFIG, type ReportConfig } from "../../lib/report/reportTypes"
import { ReportView } from "./ReportView"

// Integration layer: live export data -> resolved model -> image sidecar ->
// ReportView. The model + imageMap feed both the screen render and the PDF, so
// they can't drift. Mounted only behind the featureShotReport flag (route gate).

export default function ShotReportPage() {
  const data = useExportData()
  const [config, setConfig] = useState<ReportConfig>(DEFAULT_REPORT_CONFIG)
  const [imageMap, setImageMap] = useState<ReadonlyMap<string, string>>(new Map())
  const [imagesLoading, setImagesLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const model = useMemo(() => deriveShotReportModel(data, config), [data, config])

  // Resolve every image candidate to a data URL once the model is known.
  // resolvePdfImageSrc caches module-side, so re-resolving on config change is cheap.
  useEffect(() => {
    let cancelled = false
    const candidates = collectReportImageCandidates(model)
    if (candidates.length === 0) {
      setImageMap(new Map())
      return
    }
    setImagesLoading(true)
    resolveReportImages(candidates)
      .then((resolved) => {
        if (!cancelled) setImageMap(resolved)
      })
      .catch(() => {
        /* per-image failures already drop out of resolveReportImages */
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [model])

  const handleExportPdf = useCallback(() => {
    setExporting(true)
    // Lazy-import so @react-pdf (and its heavy deps) load only on export click,
    // keeping them out of the report route's eager chunk.
    void (async () => {
      const { generateShotReportPdf } = await import("../../lib/report/reportPdf")
      await generateShotReportPdf(
        model,
        imageMap,
        `${model.project.name} — Shot Report.pdf`,
      )
    })().finally(() => {
      setExporting(false)
    })
  }, [model, imageMap])

  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        Loading shots…
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
      <ReportView
        model={model}
        imageMap={imageMap}
        config={config}
        onConfigChange={setConfig}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />
    </div>
  )
}
