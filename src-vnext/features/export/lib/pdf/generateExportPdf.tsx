import { toast } from "sonner"
import { resolveVariables } from "../exportVariables"
import type {
  ExportDocument,
  ExportVariable,
  TextBlock,
} from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { splitByPageBreaks } from "./splitByPageBreaks"
import { resolveExportImages } from "./resolveExportImages"

/**
 * Generate a PDF blob from the export document.
 * Lazy-imports @react-pdf/renderer for code-splitting.
 */
export async function generateExportPdf(
  doc: ExportDocument,
  data: ExportData,
  variables: readonly ExportVariable[],
): Promise<void> {
  const toastId = toast.loading("Generating PDF...")

  try {
    // Step 1: Resolve text variables (page numbers resolve at render time)
    const resolvedPages = doc.pages.map((page) => ({
      ...page,
      blocks: page.blocks.map((block) => {
        if (block.type === "text") {
          return {
            ...block,
            content: resolveVariables(block.content, variables),
          } as TextBlock
        }
        return block
      }),
    }))

    const resolvedDoc = { ...doc, pages: resolvedPages }

    // Step 2: Split pages by page-break blocks
    const visualPages = splitByPageBreaks(resolvedDoc.pages)
    const allBlocks = resolvedDoc.pages.flatMap((p) => p.blocks)

    // Step 3: Pre-resolve images
    toast.loading("Resolving images...", { id: toastId })
    const imageMap = await resolveExportImages(allBlocks, data)

    // Step 4: Lazy import PDF renderer + components
    toast.loading("Rendering PDF...", { id: toastId })
    const [{ pdf }, { ExportPdfDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("./ExportPdfDocument"),
    ])

    // Step 5: Render to blob
    const element = (
      <ExportPdfDocument
        pages={visualPages}
        settings={resolvedDoc.settings}
        variables={variables}
        data={data}
        imageMap={imageMap}
      />
    )

    const blob = await pdf(element).toBlob()

    // Step 6: Download
    const fileName = safeFileName(doc.name || "export") + ".pdf"
    downloadBlob(blob, fileName)

    toast.success("PDF exported", { id: toastId })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown error"
    toast.error(`Failed to generate PDF: ${message}`, { id: toastId })
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function safeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 100)
}
