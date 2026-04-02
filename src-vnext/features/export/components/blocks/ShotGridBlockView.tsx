import { useMemo } from "react"
import { useExportDataContext } from "../ExportDataProvider"
import type { ShotGridBlock } from "../../types/exportBuilder"
import type { Shot, TalentRecord } from "@/shared/types"

interface ShotGridBlockViewProps {
  readonly block: ShotGridBlock
}

const STATUS_LABELS: Record<string, string> = {
  todo: "Draft",
  in_progress: "In Progress",
  on_hold: "On Hold",
  complete: "Shot",
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-700",
  on_hold: "bg-amber-100 text-amber-700",
  complete: "bg-green-100 text-green-700",
}

function resolveProductNames(shot: Shot): string {
  const productNames = shot.products
    .map((p) => p.familyName)
    .filter(Boolean)

  const lookNames = (shot.looks ?? [])
    .flatMap((look) => look.products.map((p) => p.familyName))
    .filter(Boolean)

  const combined = [...new Set([...productNames, ...lookNames])]
  return combined.length > 0 ? combined.join(", ") : "—"
}

function resolveTalentNames(
  shot: Shot,
  talentRecords: readonly TalentRecord[],
): string {
  if (shot.talentIds?.length) {
    const talentMap = new Map(talentRecords.map((t) => [t.id, t.name]))
    const names = shot.talentIds
      .map((id) => talentMap.get(id))
      .filter(Boolean)
    if (names.length > 0) return names.join(", ")
  }

  if (shot.talent?.length) {
    return shot.talent.join(", ")
  }

  return "—"
}

function getCellValue(
  shot: Shot,
  columnKey: string,
  talentRecords: readonly TalentRecord[],
): React.ReactNode {
  switch (columnKey) {
    case "shotNumber":
      return String(shot.shotNumber ?? "0").padStart(3, "0")
    case "thumbnail":
      return <div className="h-8 w-12 rounded bg-gray-200" />
    case "title":
      return shot.title
    case "status": {
      const label = STATUS_LABELS[shot.status] ?? shot.status
      const classes = STATUS_BADGE_CLASSES[shot.status] ?? "bg-gray-100 text-gray-700"
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
          {label}
        </span>
      )
    }
    case "products":
      return resolveProductNames(shot)
    case "talent":
      return resolveTalentNames(shot, talentRecords)
    case "location":
      return shot.locationName ?? "—"
    case "description":
      return shot.description ?? "—"
    case "tags":
      return shot.tags?.length
        ? shot.tags.map((t) => t.label).join(", ")
        : "—"
    case "notes":
      return shot.notes ?? "—"
    default:
      return "—"
  }
}

function filterShots(
  shots: readonly Shot[],
  filter: ShotGridBlock["filter"],
): readonly Shot[] {
  if (!filter) return shots

  return shots.filter((shot) => {
    if (filter.status?.length && !filter.status.includes(shot.status)) {
      return false
    }
    if (filter.tagIds?.length) {
      const shotTagIds = shot.tags?.map((t) => t.id) ?? []
      if (!filter.tagIds.some((id) => shotTagIds.includes(id))) {
        return false
      }
    }
    return true
  })
}

function sortShots(
  shots: readonly Shot[],
  sortBy: ShotGridBlock["sortBy"],
  sortDirection: ShotGridBlock["sortDirection"],
): readonly Shot[] {
  if (!sortBy) return shots

  const dir = sortDirection === "desc" ? -1 : 1

  return [...shots].sort((a, b) => {
    switch (sortBy) {
      case "shotNumber": {
        const numA = Number(a.shotNumber ?? 0)
        const numB = Number(b.shotNumber ?? 0)
        return (numA - numB) * dir
      }
      case "title":
        return a.title.localeCompare(b.title) * dir
      case "status":
        return a.status.localeCompare(b.status) * dir
      default:
        return 0
    }
  })
}

export function ShotGridBlockView({ block }: ShotGridBlockViewProps) {
  const { shots, talent } = useExportDataContext()

  const processedShots = useMemo(() => {
    const filtered = filterShots(shots, block.filter)
    return sortShots(filtered, block.sortBy, block.sortDirection)
  }, [shots, block.filter, block.sortBy, block.sortDirection])

  const visibleColumns = block.columns.filter((c) => c.visible)
  const style = block.tableStyle

  const borderClass = style?.showBorders ? "border border-gray-200" : ""
  const cellBorderClass = style?.showBorders ? "border border-gray-200" : ""
  const headerBgClass = style?.showHeaderBg ? "bg-gray-50" : ""
  const radiusStyle = style?.cornerRadius
    ? { borderRadius: `${String(style.cornerRadius)}px` }
    : undefined

  if (processedShots.length === 0) {
    return (
      <div data-testid="shot-grid-block" className="py-8 text-center text-sm text-gray-400">
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
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500 ${cellBorderClass}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {processedShots.map((shot, rowIndex) => {
              const stripeClass =
                style?.stripeRows && rowIndex % 2 === 1 ? "bg-gray-50" : ""
              return (
                <tr key={shot.id} className={stripeClass}>
                  {visibleColumns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2 text-sm text-gray-900 ${cellBorderClass}`}
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
      <p className="mt-2 text-xs text-gray-400">
        Showing {processedShots.length} {processedShots.length === 1 ? "shot" : "shots"}
      </p>
    </div>
  )
}
