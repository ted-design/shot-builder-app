import { useCallback } from "react"
import type { ShotGridBlock } from "../../types/exportBuilder"
import { ColumnTableSettings } from "./ColumnTableSettings"

const SORT_OPTIONS: readonly {
  readonly value: NonNullable<ShotGridBlock["sortBy"]>
  readonly label: string
}[] = [
  { value: "shotNumber", label: "Shot Number" },
  { value: "title", label: "Title" },
  { value: "status", label: "Status" },
]

export function ShotGridSettings({
  block,
  onUpdate,
}: {
  readonly block: ShotGridBlock
  readonly onUpdate: (updates: Partial<ShotGridBlock>) => void
}) {
  const handleSortChange = useCallback(
    (sortBy: ShotGridBlock["sortBy"]) => {
      onUpdate({ sortBy })
    },
    [onUpdate],
  )

  return (
    <ColumnTableSettings
      columns={block.columns}
      tableStyle={block.tableStyle}
      onColumnsChange={(cols) => onUpdate({ columns: cols })}
      onTableStyleChange={(style) => onUpdate({ tableStyle: style })}
    >
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Sort By
        </label>
        <select
          value={block.sortBy ?? "shotNumber"}
          onChange={(e) =>
            handleSortChange(e.target.value as ShotGridBlock["sortBy"])
          }
          data-testid="sort-select"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </ColumnTableSettings>
  )
}
