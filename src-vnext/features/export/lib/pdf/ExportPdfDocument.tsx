import { Document, Page, Text } from "@react-pdf/renderer"
import type {
  ExportBlock,
  ExportVariable,
  PageSettings,
} from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { styles, PAGE_SIZES } from "./pdfStyles"
import { WatermarkOverlay } from "./WatermarkOverlay"
import { ExportPdfBlockMapper } from "./ExportPdfBlockMapper"

interface ExportPdfDocumentProps {
  readonly pages: readonly (readonly ExportBlock[])[]
  readonly settings: PageSettings
  readonly variables: readonly ExportVariable[]
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

export function ExportPdfDocument({
  pages,
  settings,
  variables,
  data,
  imageMap,
}: ExportPdfDocumentProps) {
  const sizeKey = settings.size ?? "letter"
  const dims = PAGE_SIZES[sizeKey] ?? PAGE_SIZES.letter

  const pageSize =
    settings.layout === "landscape"
      ? { width: dims.height, height: dims.width }
      : { width: dims.width, height: dims.height }

  return (
    <Document>
      {pages.map((pageBlocks, pageIndex) => (
        <Page key={pageIndex} size={pageSize} style={styles.page} wrap>
          {settings.watermark?.text && (
            <WatermarkOverlay watermark={settings.watermark} />
          )}

          {pageBlocks.map((block) => (
            <ExportPdfBlockMapper
              key={block.id}
              block={block}
              variables={variables}
              data={data}
              imageMap={imageMap}
            />
          ))}

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
