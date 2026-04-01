import type { ShotGridBlock } from "../../types/exportBuilder"

interface ShotGridBlockViewProps {
  readonly block: ShotGridBlock
}

interface PreviewShot {
  readonly shotNumber: string
  readonly title: string
  readonly status: string
  readonly products: number
  readonly talent: string
  readonly location: string
  readonly thumbnail?: string
  readonly description?: string
  readonly tags?: string
  readonly notes?: string
}

const PREVIEW_SHOTS: readonly PreviewShot[] = [
  { shotNumber: "001", title: "LS Merino Crew - Hero", status: "Draft", products: 2, talent: "Stefan L.", location: "Stackt Market" },
  { shotNumber: "002", title: "Travel Pants - Detail", status: "In Progress", products: 1, talent: "Jessica M.", location: "Distillery" },
  { shotNumber: "003", title: "V-Neck Tee - Lifestyle", status: "Draft", products: 3, talent: "Amir K.", location: "Bellwoods" },
  { shotNumber: "004", title: "Hoodie - On Model", status: "Shot", products: 1, talent: "Claire W.", location: "Pinewood" },
  { shotNumber: "005", title: "Boxer Brief - Flat Lay", status: "On Hold", products: 1, talent: "\u2014", location: "Studio A" },
]

const STATUS_BADGE_CLASSES: Record<string, string> = {
  "Draft": "bg-gray-100 text-gray-700",
  "In Progress": "bg-blue-100 text-blue-700",
  "Shot": "bg-green-100 text-green-700",
  "On Hold": "bg-amber-100 text-amber-700",
}

function getCellValue(shot: PreviewShot, columnKey: string): React.ReactNode {
  switch (columnKey) {
    case "shotNumber":
      return shot.shotNumber
    case "thumbnail":
      return (
        <div className="h-8 w-12 rounded bg-gray-200" />
      )
    case "title":
      return shot.title
    case "status": {
      const classes = STATUS_BADGE_CLASSES[shot.status] ?? "bg-gray-100 text-gray-700"
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
          {shot.status}
        </span>
      )
    }
    case "products":
      return String(shot.products)
    case "talent":
      return shot.talent
    case "location":
      return shot.location
    case "description":
      return shot.description ?? "\u2014"
    case "tags":
      return shot.tags ?? "\u2014"
    case "notes":
      return shot.notes ?? "\u2014"
    default:
      return "\u2014"
  }
}

export function ShotGridBlockView({ block }: ShotGridBlockViewProps) {
  const visibleColumns = block.columns.filter((c) => c.visible)
  const style = block.tableStyle

  const borderClass = style?.showBorders ? "border border-gray-200" : ""
  const cellBorderClass = style?.showBorders ? "border border-gray-200" : ""
  const headerBgClass = style?.showHeaderBg ? "bg-gray-50" : ""
  const radiusStyle = style?.cornerRadius
    ? { borderRadius: `${String(style.cornerRadius)}px` }
    : undefined

  return (
    <div data-testid="shot-grid-block" className="overflow-x-auto">
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
          {PREVIEW_SHOTS.map((shot, rowIndex) => {
            const stripeClass =
              style?.stripeRows && rowIndex % 2 === 1 ? "bg-gray-50" : ""
            return (
              <tr key={shot.shotNumber} className={stripeClass}>
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-sm text-gray-900 ${cellBorderClass}`}
                  >
                    {getCellValue(shot, col.key)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
