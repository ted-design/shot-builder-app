import { View, Image } from "@react-pdf/renderer"
import type { BlockLayout, ExportBlock, ExportVariable } from "../../types/exportBuilder"
import type { ExportData } from "../../hooks/useExportData"
import { TextBlockPdf } from "./blocks/TextBlockPdf"
import { DividerBlockPdf } from "./blocks/DividerBlockPdf"
import { ShotGridBlockPdf } from "./blocks/ShotGridBlockPdf"
import { ShotDetailBlockPdf } from "./blocks/ShotDetailBlockPdf"
import { ProductTableBlockPdf } from "./blocks/ProductTableBlockPdf"
import { PullSheetBlockPdf } from "./blocks/PullSheetBlockPdf"
import { CrewListBlockPdf } from "./blocks/CrewListBlockPdf"
import { blockLayoutToPdfStyle } from "./blockLayoutToPdfStyle"

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

function getBlockLayout(block: ExportBlock): BlockLayout | undefined {
  if ("layout" in block) {
    return (block as { layout?: BlockLayout }).layout
  }
  return undefined
}

function MaybeLayoutWrap({
  layout,
  children,
}: {
  readonly layout: BlockLayout | undefined
  readonly children: React.ReactNode
}) {
  const style = blockLayoutToPdfStyle(layout)
  if (Object.keys(style).length === 0) {
    return <>{children}</>
  }
  return <View style={style}>{children}</View>
}

export function ExportPdfBlockMapper({
  block,
  variables,
  data,
  imageMap,
}: BlockMapperProps) {
  const layout = getBlockLayout(block)

  switch (block.type) {
    case "text":
      return (
        <MaybeLayoutWrap layout={layout}>
          <TextBlockPdf block={block} variables={variables} />
        </MaybeLayoutWrap>
      )
    case "divider":
      return <DividerBlockPdf block={block} />
    case "shot-grid":
      return (
        <MaybeLayoutWrap layout={layout}>
          <ShotGridBlockPdf block={block} data={data} imageMap={imageMap} />
        </MaybeLayoutWrap>
      )
    case "shot-detail":
      return (
        <MaybeLayoutWrap layout={layout}>
          <ShotDetailBlockPdf block={block} data={data} imageMap={imageMap} />
        </MaybeLayoutWrap>
      )
    case "product-table":
      return (
        <MaybeLayoutWrap layout={layout}>
          <ProductTableBlockPdf block={block} data={data} />
        </MaybeLayoutWrap>
      )
    case "pull-sheet":
      return (
        <MaybeLayoutWrap layout={layout}>
          <PullSheetBlockPdf block={block} data={data} />
        </MaybeLayoutWrap>
      )
    case "crew-list":
      return (
        <MaybeLayoutWrap layout={layout}>
          <CrewListBlockPdf block={block} data={data} />
        </MaybeLayoutWrap>
      )
    case "image": {
      if (!block.src) return null
      const resolved = imageMap.get(block.src)
      if (!resolved) return null
      return (
        <MaybeLayoutWrap layout={layout}>
          <View style={{ alignItems: alignmentToFlex(block.alignment) }}>
            <Image
              src={resolved}
              style={{ width: block.width ? `${block.width}%` : "100%" }}
            />
          </View>
        </MaybeLayoutWrap>
      )
    }
    case "page-break":
      return null // Handled at page split level
    default:
      return null
  }
}
