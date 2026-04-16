import { Document, Page, Text } from "@react-pdf/renderer"
import type {
  ExportVariable,
  PageItem,
  PageSettings,
} from "../../types/exportBuilder"
import { isHStackRow } from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { styles, PAGE_SIZES } from "./pdfStyles"
import { WatermarkOverlay } from "./WatermarkOverlay"
import { ExportPdfBlockMapper } from "./ExportPdfBlockMapper"
import { HStackRowPdf } from "./blocks/HStackRowPdf"

interface ExportPdfDocumentProps {
  readonly pages: readonly (readonly PageItem[])[]
  readonly settings: PageSettings
  readonly variables: readonly ExportVariable[]
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
  readonly documentName?: string
  readonly authorName?: string
}

/** Render a single page item (block or HStack row) as a PDF element */
function renderPageItem(
  item: PageItem,
  variables: readonly ExportVariable[],
  data: ExportData,
  imageMap: ReadonlyMap<string, string>,
): React.ReactNode {
  if (isHStackRow(item)) {
    return (
      <HStackRowPdf
        key={item.id}
        row={item}
        variables={variables}
        data={data}
        imageMap={imageMap}
      />
    )
  }
  return (
    <ExportPdfBlockMapper
      key={item.id}
      block={item}
      variables={variables}
      data={data}
      imageMap={imageMap}
    />
  )
}

export function ExportPdfDocument({
  pages,
  settings,
  variables,
  data,
  imageMap,
  documentName,
  authorName,
}: ExportPdfDocumentProps) {
  const sizeKey = settings.size ?? "letter"
  const dims = PAGE_SIZES[sizeKey] ?? PAGE_SIZES.letter

  const pageSize =
    settings.layout === "landscape"
      ? { width: dims.height, height: dims.width }
      : { width: dims.width, height: dims.height }

  return (
    <Document
      title={documentName ?? "Export"}
      author={authorName ?? ""}
      producer="Production Hub"
    >
      {pages.map((pageItems, pageIndex) => (
        <Page key={pageIndex} size={pageSize} style={styles.page} wrap>
          {settings.watermark?.text && (
            <WatermarkOverlay watermark={settings.watermark} />
          )}

          {pageItems.map((item) =>
            renderPageItem(item, variables, data, imageMap),
          )}

          <Text
            fixed
            style={styles.pageFooter}
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </Page>
      ))}
    </Document>
  )
}
