import { useCallback } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/ui/button"
import type { BlockLayout, ExportBlock } from "../types/exportBuilder"
import { TextSettings } from "./settings/TextSettings"
import { ShotGridSettings } from "./settings/ShotGridSettings"
import { DividerSettings } from "./settings/DividerSettings"
import { ImageSettings } from "./settings/ImageSettings"
import { ProductTableSettings } from "./settings/ProductTableSettings"
import { BlockLayoutSettings } from "./settings/BlockLayoutSettings"

interface BlockSettingsPanelProps {
  readonly block: ExportBlock | null
  readonly onUpdateBlock: (blockId: string, updates: Partial<ExportBlock>) => void
  readonly onDeleteBlock: (blockId: string) => void
  readonly clientId?: string | null
  readonly projectId?: string
}

const BLOCK_TYPE_LABELS: Record<string, string> = {
  text: "Text Block",
  image: "Image Block",
  "shot-grid": "Shot Grid",
  "shot-detail": "Shot Detail",
  "product-table": "Product Table",
  "pull-sheet": "Pull Sheet",
  "crew-list": "Crew List",
  divider: "Divider",
  "page-break": "Page Break",
}

export function BlockSettingsPanel({
  block,
  onUpdateBlock,
  onDeleteBlock,
  clientId,
  projectId,
}: BlockSettingsPanelProps) {
  const handleUpdate = useCallback(
    (updates: Partial<ExportBlock>) => {
      if (block) {
        onUpdateBlock(block.id, updates)
      }
    },
    [block, onUpdateBlock],
  )

  const handleLayoutUpdate = useCallback(
    (newLayout: BlockLayout) => {
      if (block) {
        onUpdateBlock(block.id, { layout: newLayout } as Partial<ExportBlock>)
      }
    },
    [block, onUpdateBlock],
  )

  if (!block) {
    return (
      <aside className="flex w-[280px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-2xs text-[var(--color-text-muted)] text-center">
            Select a block to edit its settings.
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside
      data-testid="block-settings-panel"
      className="flex w-[280px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {BLOCK_TYPE_LABELS[block.type] ?? "Block Settings"}
        </h2>
        <p className="mt-0.5 text-2xs text-[var(--color-text-muted)]">
          Configure this block
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {block.type === "text" && (
          <TextSettings block={block} onUpdate={handleUpdate} />
        )}
        {block.type === "shot-grid" && (
          <ShotGridSettings block={block} onUpdate={handleUpdate} />
        )}
        {block.type === "divider" && (
          <DividerSettings block={block} onUpdate={handleUpdate} />
        )}
        {block.type === "image" && (
          <ImageSettings
            block={block}
            onUpdate={handleUpdate}
            clientId={clientId}
            projectId={projectId}
          />
        )}
        {block.type === "product-table" && (
          <ProductTableSettings block={block} onUpdate={handleUpdate} />
        )}
        {block.type !== "text" &&
          block.type !== "shot-grid" &&
          block.type !== "divider" &&
          block.type !== "image" &&
          block.type !== "product-table" && (
            <p className="text-2xs text-[var(--color-text-muted)]">
              No additional settings for this block type.
            </p>
          )}
        {block.type !== "divider" && block.type !== "page-break" && (
          <BlockLayoutSettings
            layout={(block as { layout?: BlockLayout }).layout}
            onUpdate={handleLayoutUpdate}
          />
        )}
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDeleteBlock(block.id)}
          className="w-full justify-center text-[var(--color-error)] hover:bg-[var(--color-error-subtle)] hover:text-[var(--color-error)]"
          data-testid="delete-block-btn"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete Block
        </Button>
      </div>
    </aside>
  )
}
