import { useMemo } from "react"
import { useExportDataContext } from "../ExportDataProvider"
import type { ShotGridBlock, ShotGridColumn } from "../../types/exportBuilder"
import { COLUMN_WIDTH_PRESETS } from "../../types/exportBuilder"
import {
  resolveProductNamesString,
  resolveTalentNames,
  filterShots,
  sortShots,
} from "../../lib/blockDataResolvers"
import {
  getShotStatusLabel,
  getShotStatusColor,
} from "@/shared/lib/statusMappings"
import type { Shot, ShotFirestoreStatus, TalentRecord } from "@/shared/types"

interface ShotGridBlockViewProps {
  readonly block: ShotGridBlock
}

function statusBadgeClasses(status: string): string {
  const color = getShotStatusColor(status as ShotFirestoreStatus)
  return `bg-[var(--color-status-${color}-bg)] text-[var(--color-status-${color}-text)]`
}

function getCellValue(
  shot: Shot,
  columnKey: string,
  talentRecords: readonly TalentRecord[],
): React.ReactNode {
  switch (columnKey) {
    case "shotNumber":
      return shot.shotNumber || "\u2014"
    case "thumbnail":
      return <div className="h-8 w-12 rounded bg-[var(--color-surface-muted)]" />
    case "title":
      return shot.title
    case "status": {
      const label = getShotStatusLabel(shot.status as ShotFirestoreStatus)
      const classes = statusBadgeClasses(shot.status)
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
          {label}
        </span>
      )
    }
    case "products":
      return resolveProductNamesString(shot)
    case "talent":
      return resolveTalentNames(shot, talentRecords)
    case "location":
      return shot.locationName ?? "\u2014"
    case "description":
      return shot.description ?? "\u2014"
    case "tags":
      return shot.tags?.length
        ? shot.tags.map((t) => t.label).join(", ")
        : "\u2014"
    case "notes":
      return shot.notes ?? "\u2014"
    default:
      return "\u2014"
  }
}

function colFlexValue(col: ShotGridColumn): number {
  return COLUMN_WIDTH_PRESETS[col.width ?? "md"].flex
}

function colWidthPercent(
  col: ShotGridColumn,
  allVisible: readonly ShotGridColumn[],
): string {
  const totalFlex = allVisible.reduce((sum, c) => sum + colFlexValue(c), 0)
  return `${(colFlexValue(col) / totalFlex * 100).toFixed(1)}%`
}

export function ShotGridBlockView({ block }: ShotGridBlockViewProps) {
  const { shots, talent } = useExportDataContext()

  const processedShots = useMemo(() => {
    const filtered = filterShots(shots, block.filter)
    return sortShots(filtered, block.sortBy, block.sortDirection)
  }, [shots, block.filter, block.sortBy, block.sortDirection])

  const visibleColumns = [...block.columns]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((c) => c.visible)
  const style = block.tableStyle

  const borderClass = style?.showBorders ? "border border-[var(--color-border)]" : ""
  const cellBorderClass = style?.showBorders ? "border border-[var(--color-border)]" : ""
  const headerBgClass = style?.showHeaderBg ? "bg-[var(--color-surface-subtle)]" : ""
  const radiusStyle = style?.cornerRadius
    ? { borderRadius: `${String(style.cornerRadius)}px` }
    : undefined

  if (processedShots.length === 0) {
    return (
      <div data-testid="shot-grid-block" className="py-8 text-center text-sm text-[var(--color-text-subtle)]">
        No shots in this project
      </div>
    )
  }

  return (
    <div data-testid="shot-grid-block">
      <div className="overflow-x-auto">
        <table
          className={`w-full text-left text-sm ${borderClass}`}
          style={{ ...radiusStyle, borderCollapse: "separate", borderSpacing: 0 }}
        >
          <thead>
            <tr className={headerBgClass}>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: colWidthPercent(col, visibleColumns) }}
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] ${cellBorderClass}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedShots.map((shot, rowIndex) => {
              const stripeClass =
                style?.stripeRows && rowIndex % 2 === 1 ? "bg-[var(--color-surface-subtle)]" : ""
              return (
                <tr key={shot.id} className={stripeClass}>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      style={{ width: colWidthPercent(col, visibleColumns) }}
                      className={`px-3 py-2 text-sm text-[var(--color-text)] ${cellBorderClass}`}
                    >
                      {getCellValue(shot, col.key, talent)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-subtle)]">
        Showing {processedShots.length} {processedShots.length === 1 ? "shot" : "shots"}
      </p>
    </div>
  )
}
