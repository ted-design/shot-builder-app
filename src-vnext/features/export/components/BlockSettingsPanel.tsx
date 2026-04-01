import { useCallback } from "react"
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react"
import { Button } from "@/ui/button"
import type {
  ExportBlock,
  TextBlock,
  ShotGridBlock,
  DividerBlock,
  ShotGridColumn,
} from "../types/exportBuilder"

interface BlockSettingsPanelProps {
  readonly block: ExportBlock | null
  readonly onUpdateBlock: (blockId: string, updates: Partial<ExportBlock>) => void
  readonly onDeleteBlock: (blockId: string) => void
}

function TextSettings({
  block,
  onUpdate,
}: {
  readonly block: TextBlock
  readonly onUpdate: (updates: Partial<TextBlock>) => void
}) {
  const fontSize = block.typography?.fontSize ?? 14
  const textAlign = block.typography?.textAlign ?? "left"

  const handleFontSizeChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 1) return
      onUpdate({
        typography: {
          ...block.typography,
          fontSize: parsed,
        },
      })
    },
    [block.typography, onUpdate],
  )

  const handleAlignChange = useCallback(
    (align: "left" | "center" | "right") => {
      onUpdate({
        typography: {
          ...block.typography,
          textAlign: align,
        },
      })
    },
    [block.typography, onUpdate],
  )

  const alignButtons: readonly { readonly value: "left" | "center" | "right"; readonly Icon: typeof AlignLeft }[] = [
    { value: "left", Icon: AlignLeft },
    { value: "center", Icon: AlignCenter },
    { value: "right", Icon: AlignRight },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Font Size (px)
        </label>
        <input
          type="number"
          min={8}
          max={96}
          value={fontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Text Align
        </label>
        <div className="mt-1 flex gap-1">
          {alignButtons.map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleAlignChange(value)}
              data-testid={`align-${value}`}
              className={`rounded-md p-1.5 transition-colors ${
                textAlign === value
                  ? "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Content
        </label>
        <textarea
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder="Enter text or use {{variables}}..."
          rows={4}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] resize-none"
        />
      </div>
    </div>
  )
}

function ShotGridSettings({
  block,
  onUpdate,
}: {
  readonly block: ShotGridBlock
  readonly onUpdate: (updates: Partial<ShotGridBlock>) => void
}) {
  const handleColumnToggle = useCallback(
    (columnKey: string) => {
      const updatedColumns = block.columns.map((col) =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col,
      )
      onUpdate({ columns: updatedColumns })
    },
    [block.columns, onUpdate],
  )

  const handleTableStyleToggle = useCallback(
    (key: keyof NonNullable<ShotGridBlock["tableStyle"]>) => {
      const current = block.tableStyle ?? {}
      onUpdate({
        tableStyle: {
          ...current,
          [key]: !current[key],
        },
      })
    },
    [block.tableStyle, onUpdate],
  )

  const handleSortChange = useCallback(
    (sortBy: ShotGridBlock["sortBy"]) => {
      onUpdate({ sortBy })
    },
    [onUpdate],
  )

  const styleToggles: readonly { readonly key: keyof NonNullable<ShotGridBlock["tableStyle"]>; readonly label: string }[] = [
    { key: "showBorders", label: "Borders" },
    { key: "showHeaderBg", label: "Header Background" },
    { key: "stripeRows", label: "Stripe Rows" },
  ]

  const sortOptions: readonly { readonly value: NonNullable<ShotGridBlock["sortBy"]>; readonly label: string }[] = [
    { value: "shotNumber", label: "Shot Number" },
    { value: "title", label: "Title" },
    { value: "status", label: "Status" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Columns
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {block.columns.map((col: ShotGridColumn) => (
            <button
              key={col.key}
              type="button"
              onClick={() => handleColumnToggle(col.key)}
              data-testid={`col-toggle-${col.key}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
            >
              {col.visible ? (
                <Eye className="h-3.5 w-3.5 text-[var(--color-text)]" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
              )}
              <span
                className={
                  col.visible
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)]"
                }
              >
                {col.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Table Style
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {styleToggles.map(({ key, label }) => {
            const checked = block.tableStyle?.[key] ?? false
            return (
              <label
                key={key}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleTableStyleToggle(key)}
                  data-testid={`style-toggle-${key}`}
                  className="rounded border-[var(--color-border)]"
                />
                <span className="text-[var(--color-text)]">{label}</span>
              </label>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Sort By
        </label>
        <select
          value={block.sortBy ?? "shotNumber"}
          onChange={(e) => handleSortChange(e.target.value as ShotGridBlock["sortBy"])}
          data-testid="sort-select"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function DividerSettings({
  block,
  onUpdate,
}: {
  readonly block: DividerBlock
  readonly onUpdate: (updates: Partial<DividerBlock>) => void
}) {
  const styleOptions: readonly { readonly value: NonNullable<DividerBlock["style"]>; readonly label: string }[] = [
    { value: "solid", label: "Solid" },
    { value: "dashed", label: "Dashed" },
    { value: "dotted", label: "Dotted" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Style
        </label>
        <select
          value={block.style ?? "solid"}
          onChange={(e) =>
            onUpdate({ style: e.target.value as DividerBlock["style"] })
          }
          data-testid="divider-style-select"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        >
          {styleOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
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
}: BlockSettingsPanelProps) {
  const handleUpdate = useCallback(
    (updates: Partial<ExportBlock>) => {
      if (block) {
        onUpdateBlock(block.id, updates)
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
        {block.type !== "text" &&
          block.type !== "shot-grid" &&
          block.type !== "divider" && (
            <p className="text-2xs text-[var(--color-text-muted)]">
              No additional settings for this block type.
            </p>
          )}
      </div>

      <div className="border-t border-[var(--color-border)] px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDeleteBlock(block.id)}
          className="w-full justify-center text-red-600 hover:bg-red-50 hover:text-red-700"
          data-testid="delete-block-btn"
        >
          <Trash2 className="mr-1.5 h-4 w-4" />
          Delete Block
        </Button>
      </div>
    </aside>
  )
}
