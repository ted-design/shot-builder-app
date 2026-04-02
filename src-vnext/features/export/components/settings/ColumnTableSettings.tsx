import { useCallback, type ReactNode } from "react"
import { Eye, EyeOff } from "lucide-react"
import type { ColumnWidthPreset, TableStyle } from "../../types/exportBuilder"
import { COLUMN_WIDTH_PRESETS } from "../../types/exportBuilder"

const WIDTH_PRESET_OPTIONS: readonly {
  readonly value: ColumnWidthPreset
  readonly label: string
}[] = Object.entries(COLUMN_WIDTH_PRESETS).map(([value, { label }]) => ({
  value: value as ColumnWidthPreset,
  label,
}))

interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly visible: boolean
  readonly width?: ColumnWidthPreset
}

interface ColumnTableSettingsProps<C extends ColumnDef> {
  readonly columns: readonly C[]
  readonly tableStyle: TableStyle | undefined
  readonly onColumnsChange: (columns: readonly C[]) => void
  readonly onTableStyleChange: (style: TableStyle) => void
  readonly children?: ReactNode
}

const STYLE_TOGGLES: readonly {
  readonly key: keyof TableStyle
  readonly label: string
}[] = [
  { key: "showBorders", label: "Borders" },
  { key: "showHeaderBg", label: "Header Background" },
  { key: "stripeRows", label: "Stripe Rows" },
]

export function ColumnTableSettings<C extends ColumnDef>({
  columns,
  tableStyle,
  onColumnsChange,
  onTableStyleChange,
  children,
}: ColumnTableSettingsProps<C>) {
  const handleColumnToggle = useCallback(
    (columnKey: string) => {
      const updatedColumns = columns.map((col) =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col,
      )
      onColumnsChange(updatedColumns)
    },
    [columns, onColumnsChange],
  )

  const handleColumnWidthChange = useCallback(
    (columnKey: string, width: string) => {
      const updatedColumns = columns.map((col) =>
        col.key === columnKey
          ? { ...col, width: width as ColumnWidthPreset }
          : col,
      )
      onColumnsChange(updatedColumns)
    },
    [columns, onColumnsChange],
  )

  const handleTableStyleToggle = useCallback(
    (key: keyof TableStyle) => {
      const current = tableStyle ?? {}
      onTableStyleChange({
        ...current,
        [key]: !current[key],
      })
    },
    [tableStyle, onTableStyleChange],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Columns
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {columns.map((col) => (
            <div
              key={col.key}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
            >
              <button
                type="button"
                onClick={() => handleColumnToggle(col.key)}
                data-testid={`col-toggle-${col.key}`}
                className="shrink-0"
              >
                {col.visible ? (
                  <Eye className="h-3.5 w-3.5 text-[var(--color-text)]" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                )}
              </button>
              <span
                className={`flex-1 ${
                  col.visible
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)]"
                }`}
              >
                {col.label}
              </span>
              <select
                value={col.width ?? "md"}
                onChange={(e) =>
                  handleColumnWidthChange(col.key, e.target.value)
                }
                onClick={(e) => e.stopPropagation()}
                data-testid={`col-width-${col.key}`}
                className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-text)]"
              >
                {WIDTH_PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Table Style
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {STYLE_TOGGLES.map(({ key, label }) => {
            const checked = Boolean(tableStyle?.[key])
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
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

      {children}
    </div>
  )
}
