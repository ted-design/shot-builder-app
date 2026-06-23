import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { useExportData } from "../../hooks/useExportData"
import { useExportReports } from "../../hooks/useExportReports"
import {
  collectProductInfoImageCandidates,
  deriveProductInfoModel,
} from "../../lib/report/productInfoModel"
import { resolveReportImages } from "../../lib/report/reportImages"
import {
  DEFAULT_PRODUCT_INFO_CONFIG,
  type ProductInfoConfig,
} from "../../lib/report/productInfoTypes"
import { ProductInfoReportView } from "./ProductInfoReportView"

// Integration layer: live export data -> resolved product-info model -> image
// sidecar -> ProductInfoReportView. The model + imageMap feed both the screen
// render and the PDF, so they can't drift. Mounted only behind the
// featureProductInfoReport flag (route gate). Mirrors ShotReportPage.

export default function ProductInfoReportPage() {
  const data = useExportData()
  const { id: projectId } = useParams<{ id: string }>()
  const { clientId } = useAuth()
  const [searchParams] = useSearchParams()
  const reportId = searchParams.get("reportId")
  const { loadReport, saveReportConfig } = useExportReports(clientId, projectId)

  const [config, setConfig] = useState<ProductInfoConfig>(DEFAULT_PRODUCT_INFO_CONFIG)
  const [imageMap, setImageMap] = useState<ReadonlyMap<string, string>>(new Map())
  const [imagesLoading, setImagesLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The reportId that has finished hydrating. Edits made while a report is still
  // loading must not persist — they'd save the outgoing report's config onto it.
  const hydratedReportIdRef = useRef<string | null>(null)

  // Hydrate config from a saved product-info doc when ?reportId= is present, else
  // reset to defaults. Switching reports (or clearing reportId) also cancels any
  // pending write from the previous report. Default-merge so an older blob parses.
  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current)
    hydratedReportIdRef.current = null
    if (!reportId) {
      setConfig(DEFAULT_PRODUCT_INFO_CONFIG)
      return
    }
    let cancelled = false
    void loadReport(reportId)
      .then((full) => {
        if (cancelled) return
        // This page only loads product-info docs; config narrows to ProductInfoConfig.
        const loaded = full?.config as ProductInfoConfig | undefined
        setConfig(
          loaded ? { ...DEFAULT_PRODUCT_INFO_CONFIG, ...loaded } : DEFAULT_PRODUCT_INFO_CONFIG,
        )
        hydratedReportIdRef.current = reportId
      })
      .catch(() => {
        /* keep defaults on a transient load failure */
      })
    return () => {
      cancelled = true
    }
  }, [reportId, loadReport])

  // User edits persist (debounced) only when editing a saved report that has
  // hydrated. Hydration uses setConfig directly, so it never triggers a write-back.
  const handleConfigChange = useCallback(
    (next: ProductInfoConfig) => {
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

  // Cancel a pending config write if we unmount inside the debounce window.
  useEffect(
    () => () => {
      if (persistTimer.current) clearTimeout(persistTimer.current)
    },
    [],
  )

  const model = useMemo(() => deriveProductInfoModel(data, config), [data, config])

  // Resolve every image candidate to a data URL once the model is known.
  // resolvePdfImageSrc caches module-side, so re-resolving on config change is cheap.
  useEffect(() => {
    let cancelled = false
    const candidates = collectProductInfoImageCandidates(model)
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
      const { generateProductInfoPdf } = await import("../../lib/report/reportPdfProductInfo")
      await generateProductInfoPdf(
        model,
        imageMap,
        `${model.project.name} — Product Info.pdf`,
      )
    })().finally(() => {
      setExporting(false)
    })
  }, [model, imageMap])

  if (data.loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-secondary)]">
        Loading products…
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
      <ProductInfoReportView
        model={model}
        imageMap={imageMap}
        config={config}
        onConfigChange={handleConfigChange}
        onExportPdf={handleExportPdf}
        exporting={exporting}
      />
    </div>
  )
}
