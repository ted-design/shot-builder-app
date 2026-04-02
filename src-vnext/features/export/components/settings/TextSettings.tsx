import { useCallback } from "react"
import { AlignLeft, AlignCenter, AlignRight } from "lucide-react"
import type { TextBlock } from "../../types/exportBuilder"

export function TextSettings({
  block,
  onUpdate,
}: {
  readonly block: TextBlock
  readonly onUpdate: (updates: Partial<TextBlock>) => void
}) {
  const fontSize = block.typography?.fontSize ?? 14
  const textAlign = block.typography?.textAlign ?? "left"
  const fontFamily = block.typography?.fontFamily ?? "Inter"
  const fontColor = block.typography?.fontColor ?? "#000000"
  const highlightColor = block.typography?.highlightColor ?? ""
  const blockType = block.typography?.blockType ?? "p"

  const handleTypographyChange = useCallback(
    (key: string, value: string | number | undefined) => {
      onUpdate({
        typography: {
          ...block.typography,
          [key]: value,
        },
      })
    },
    [block.typography, onUpdate],
  )

  const handleFontSizeChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 1) return
      handleTypographyChange("fontSize", parsed)
    },
    [handleTypographyChange],
  )

  const handleAlignChange = useCallback(
    (align: "left" | "center" | "right") => {
      handleTypographyChange("textAlign", align)
    },
    [handleTypographyChange],
  )

  const alignButtons: readonly {
    readonly value: "left" | "center" | "right"
    readonly Icon: typeof AlignLeft
  }[] = [
    { value: "left", Icon: AlignLeft },
    { value: "center", Icon: AlignCenter },
    { value: "right", Icon: AlignRight },
  ]

  const selectClass =
    "mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
  const labelClass = "text-2xs font-medium text-[var(--color-text-muted)]"

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass}>Type</label>
        <select
          value={blockType}
          onChange={(e) => handleTypographyChange("blockType", e.target.value)}
          data-testid="text-block-type"
          className={selectClass}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Font Family</label>
        <select
          value={fontFamily}
          onChange={(e) => handleTypographyChange("fontFamily", e.target.value)}
          data-testid="text-font-family"
          className={selectClass}
        >
          <option value="Inter">Inter</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Georgia">Georgia</option>
          <option value="Courier New">Courier New</option>
          <option value="Arial">Arial</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Font Size (px)</label>
        <input
          type="number"
          min={8}
          max={96}
          value={fontSize}
          onChange={(e) => handleFontSizeChange(e.target.value)}
          className={selectClass}
        />
      </div>

      <div>
        <label className={labelClass}>Font Color</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={fontColor}
            onChange={(e) => handleTypographyChange("fontColor", e.target.value)}
            data-testid="text-font-color"
            className="h-8 w-8 rounded border border-[var(--color-border)] cursor-pointer"
          />
          <span className="text-2xs text-[var(--color-text-muted)]">{fontColor}</span>
        </div>
      </div>

      <div>
        <label className={labelClass}>Highlight Color</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={highlightColor || "#ffffff"}
            onChange={(e) => handleTypographyChange("highlightColor", e.target.value)}
            data-testid="text-highlight-color"
            className="h-8 w-8 rounded border border-[var(--color-border)] cursor-pointer"
          />
          <span className="text-2xs text-[var(--color-text-muted)]">
            {highlightColor || "None"}
          </span>
          {highlightColor && (
            <button
              type="button"
              onClick={() => handleTypographyChange("highlightColor", undefined)}
              data-testid="text-highlight-clear"
              className="text-2xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Text Align</label>
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
        <label className={labelClass}>Content</label>
        <textarea
          value={block.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          placeholder={"Enter text or use {{variables}}..."}
          rows={4}
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)] resize-none"
        />
      </div>
    </div>
  )
}
