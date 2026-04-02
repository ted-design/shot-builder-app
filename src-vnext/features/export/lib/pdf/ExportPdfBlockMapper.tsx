import { View, Image } from "@react-pdf/renderer"
import type { ExportBlock, ExportVariable } from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { TextBlockPdf } from "./blocks/TextBlockPdf"
import { DividerBlockPdf } from "./blocks/DividerBlockPdf"
import { ShotGridBlockPdf } from "./blocks/ShotGridBlockPdf"
import { ShotDetailBlockPdf } from "./blocks/ShotDetailBlockPdf"
import { ProductTableBlockPdf } from "./blocks/ProductTableBlockPdf"
import { PullSheetBlockPdf } from "./blocks/PullSheetBlockPdf"
import { CrewListBlockPdf } from "./blocks/CrewListBlockPdf"

interface BlockMapperProps {
  readonly block: ExportBlock
  readonly variables: readonly ExportVariable[]
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

function alignmentToFlex(
  alignment?: "left" | "center" | "right",
): "flex-start" | "center" | "flex-end" {
  if (alignment === "center") return "center"
  if (alignment === "right") return "flex-end"
  return "flex-start"
}

export function ExportPdfBlockMapper({
  block,
  variables,
  data,
  imageMap,
}: BlockMapperProps) {
  switch (block.type) {
    case "text":
      return <TextBlockPdf block={block} variables={variables} />
    case "divider":
      return <DividerBlockPdf block={block} />
    case "shot-grid":
      return (
        <ShotGridBlockPdf block={block} data={data} imageMap={imageMap} />
      )
    case "shot-detail":
      return (
        <ShotDetailBlockPdf block={block} data={data} imageMap={imageMap} />
      )
    case "product-table":
      return <ProductTableBlockPdf block={block} data={data} />
    case "pull-sheet":
      return <PullSheetBlockPdf block={block} data={data} />
    case "crew-list":
      return <CrewListBlockPdf block={block} data={data} />
    case "image": {
      if (!block.src) return null
      const resolved = imageMap.get(block.src)
      if (!resolved) return null
      return (
        <View style={{ alignItems: alignmentToFlex(block.alignment) }}>
          <Image
            src={resolved}
            style={{ width: block.width ? `${block.width}%` : "100%" }}
          />
        </View>
      )
    }
    case "page-break":
      return null // Handled at page split level
    default:
      return null
  }
}
