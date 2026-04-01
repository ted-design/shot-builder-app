import type { ExportBlock, ExportVariable } from "../types/exportBuilder"
import { TextBlockView } from "./blocks/TextBlockView"
import { ImageBlockView } from "./blocks/ImageBlockView"
import { ShotGridBlockView } from "./blocks/ShotGridBlockView"
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
      return (
        <div data-testid="shot-detail-block" className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Shot Detail Block (connects to project data at export time)
        </div>
      )
    case "product-table":
      return (
        <div data-testid="product-table-block" className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Product Table Block (connects to project data at export time)
        </div>
      )
    case "pull-sheet":
      return (
        <div data-testid="pull-sheet-block" className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Pull Sheet Block (connects to project data at export time)
        </div>
      )
    case "crew-list":
      return (
        <div data-testid="crew-list-block" className="rounded border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-400">
          Crew List Block (connects to project data at export time)
        </div>
      )
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
