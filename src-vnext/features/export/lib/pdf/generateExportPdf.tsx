import { toast } from "sonner"
import { resolveVariables } from "../exportVariables"
import type {
  ExportDocument,
  ExportVariable,
  PageItem,
  TextBlock,
} from "../../types/exportBuilder"
import { isHStackRow } from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { splitByPageBreaks, flattenPagesToBlocks } from "./splitByPageBreaks"
import { resolveExportImages } from "./resolveExportImages"

/** Resolve text variables inside all blocks, including those nested in HStack columns */
function resolveItemVariables(
  items: readonly PageItem[],
  variables: readonly ExportVariable[],
): readonly PageItem[] {
  return items.map((item) => {
    if (isHStackRow(item)) {
      return {
        ...item,
        columns: item.columns.map((col) => ({
          ...col,
          blocks: col.blocks.map((block) => {
            if (block.type === "text") {
              return {
                ...block,
                content: resolveVariables(block.content, variables),
              } as TextBlock
            }
            return block
          }),
        })),
      }
    }
    if (item.type === "text") {
      return {
        ...item,
        content: resolveVariables(item.content, variables),
      } as TextBlock
    }
    return item
  })
}

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
      items: resolveItemVariables(page.items, variables),
    }))

    const resolvedDoc = { ...doc, pages: resolvedPages }

    // Step 2: Split pages by page-break blocks (preserves HStack rows)
    const visualPages = splitByPageBreaks(resolvedDoc.pages)
    const allBlocks = flattenPagesToBlocks(resolvedDoc.pages)

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
