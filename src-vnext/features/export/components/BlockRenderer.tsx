import type { BlockLayout, ExportBlock, ExportVariable } from "../types/exportBuilder"
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
  readonly onUpdateBlock?: (blockId: string, updates: Partial<ExportBlock>) => void
}

function renderBlockContent(
  block: ExportBlock,
  variables: readonly ExportVariable[],
  onUpdateBlock?: (blockId: string, updates: Partial<ExportBlock>) => void,
): React.ReactNode {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} variables={variables} onUpdateBlock={onUpdateBlock} />
    case "image":
      return (
        <ImageBlockView
          block={block}
          onImageUploaded={
            onUpdateBlock
              ? (src: string) => onUpdateBlock(block.id, { src })
              : undefined
          }
          onWidthChange={
            onUpdateBlock
              ? (w: number) => onUpdateBlock(block.id, { width: w })
              : undefined
          }
        />
      )
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

function buildLayoutStyle(layout: BlockLayout | undefined): React.CSSProperties {
  const style: React.CSSProperties = {
    // Always set padding — defaults match the old px-4 py-3 (16px, 12px)
    paddingTop: layout?.paddingTop ?? 12,
    paddingRight: layout?.paddingRight ?? 16,
    paddingBottom: layout?.paddingBottom ?? 12,
    paddingLeft: layout?.paddingLeft ?? 16,
  }

  // Margin (only when explicitly set)
  if (layout?.marginTop) style.marginTop = layout.marginTop
  if (layout?.marginRight) style.marginRight = layout.marginRight
  if (layout?.marginBottom) style.marginBottom = layout.marginBottom
  if (layout?.marginLeft) style.marginLeft = layout.marginLeft

  // Border
  if (layout?.borderWidth) {
    style.borderWidth = layout.borderWidth
    style.borderColor = layout.borderColor ?? "#000"
    style.borderStyle = layout.borderStyle === "none" ? undefined : (layout.borderStyle ?? "solid")
  }
  if (layout?.borderRadius) style.borderRadius = layout.borderRadius

  // Background
  if (layout?.backgroundColor) style.backgroundColor = layout.backgroundColor

  // Min height
  if (layout?.minHeight) style.minHeight = layout.minHeight

  return style
}

export function BlockRenderer({
  block,
  selected,
  onSelect,
  variables,
  onUpdateBlock,
}: BlockRendererProps) {
  // page-break blocks are rendered as separators at the DocumentPreview level
  if (block.type === "page-break") {
    return null
  }

  const selectionRing = selected
    ? "ring-2 ring-[var(--color-accent)] ring-offset-1"
    : "ring-0 hover:ring-1 hover:ring-[var(--color-border)]"

  const blockLayout = "layout" in block ? (block as { layout?: BlockLayout }).layout : undefined
  const layoutStyle = buildLayoutStyle(blockLayout)

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
      style={layoutStyle}
      className={`cursor-pointer rounded transition-shadow ${selectionRing}`}
    >
      {renderBlockContent(block, variables, onUpdateBlock)}
    </div>
  )
}
