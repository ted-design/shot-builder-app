import type { ExportBlock, ExportVariable } from "../types/exportBuilder"
import { TextBlockView } from "./blocks/TextBlockView"
import { ImageBlockView } from "./blocks/ImageBlockView"
import { ShotGridBlockView } from "./blocks/ShotGridBlockView"
import { ShotDetailBlockView } from "./blocks/ShotDetailBlockView"
import { ProductTableBlockView } from "./blocks/ProductTableBlockView"
import { PullSheetBlockView } from "./blocks/PullSheetBlockView"
import { CrewListBlockView } from "./blocks/CrewListBlockView"
import { DividerBlockView } from "./blocks/DividerBlockView"

interface BlockRendererProps {
  readonly block: ExportBlock
  readonly selected: boolean
  readonly onSelect: () => void
  readonly variables: readonly ExportVariable[]
}

function renderBlockContent(
  block: ExportBlock,
  variables: readonly ExportVariable[],
): React.ReactNode {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} variables={variables} />
    case "image":
      return <ImageBlockView block={block} />
    case "shot-grid":
      return <ShotGridBlockView block={block} />
    case "divider":
      return <DividerBlockView block={block} />
    case "page-break":
      // Page breaks are handled at the DocumentPreview level
      return null
    case "shot-detail":
      return <ShotDetailBlockView block={block} />
    case "product-table":
      return <ProductTableBlockView block={block} />
    case "pull-sheet":
      return <PullSheetBlockView block={block} />
    case "crew-list":
      return <CrewListBlockView block={block} />
    default:
      return null
  }
}

export function BlockRenderer({
  block,
  selected,
  onSelect,
  variables,
}: BlockRendererProps) {
  // page-break blocks are rendered as separators at the DocumentPreview level
  if (block.type === "page-break") {
    return null
  }

  const selectionRing = selected
    ? "ring-2 ring-blue-500 ring-offset-1"
    : "ring-0 hover:ring-1 hover:ring-gray-300"

  return (
    <div
      data-testid={`block-${block.id}`}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          e.stopPropagation()
          onSelect()
        }
      }}
      className={`cursor-pointer rounded px-4 py-3 transition-shadow ${selectionRing}`}
    >
      {renderBlockContent(block, variables)}
    </div>
  )
}
