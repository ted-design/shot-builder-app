import { useExportDataContext } from "../ExportDataProvider"
import type { PullSheetBlock } from "../../types/exportBuilder"

const SELECT_CLASS =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"

export function PullSheetSettings({
  block,
  onUpdate,
}: {
  readonly block: PullSheetBlock
  readonly onUpdate: (updates: Partial<PullSheetBlock>) => void
}) {
  const { pulls } = useExportDataContext()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Pull sheet
        </label>
        <select
          value={block.pullId ?? ""}
          onChange={(e) => onUpdate({ pullId: e.target.value || undefined })}
          data-testid="pull-sheet-pull-select"
          className={SELECT_CLASS}
        >
          {/* Empty value falls back to the first pull (PullSheetBlockView default). */}
          <option value="">
            {pulls.length > 0 ? "First pull sheet" : "No pull sheets"}
          </option>
          {pulls.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name ?? p.title ?? "Pull Sheet"}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={block.showFulfillmentStatus !== false}
          onChange={(e) => onUpdate({ showFulfillmentStatus: e.target.checked })}
          data-testid="pull-sheet-show-status"
        />
        Show fulfillment status
      </label>
    </div>
  )
}
