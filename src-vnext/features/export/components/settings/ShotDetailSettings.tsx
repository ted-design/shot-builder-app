import { useExportDataContext } from "../ExportDataProvider"
import type { ShotDetailBlock } from "../../types/exportBuilder"

type ShotDetailToggleKey =
  | "showHeroImage"
  | "showDescription"
  | "showNotes"
  | "showProducts"

const TOGGLES: readonly { readonly key: ShotDetailToggleKey; readonly label: string }[] = [
  { key: "showHeroImage", label: "Hero image" },
  { key: "showDescription", label: "Description" },
  { key: "showNotes", label: "Notes" },
  { key: "showProducts", label: "Products" },
]

const SELECT_CLASS =
  "mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"

export function ShotDetailSettings({
  block,
  onUpdate,
}: {
  readonly block: ShotDetailBlock
  readonly onUpdate: (updates: Partial<ShotDetailBlock>) => void
}) {
  const { shots } = useExportDataContext()

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Shot
        </label>
        <select
          value={block.shotId ?? ""}
          onChange={(e) => onUpdate({ shotId: e.target.value || undefined })}
          data-testid="shot-detail-shot-select"
          className={SELECT_CLASS}
        >
          <option value="">Select a shot…</option>
          {shots.map((s) => (
            <option key={s.id} value={s.id}>
              #{s.shotNumber || "—"} {s.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <span className="text-2xs font-medium text-[var(--color-text-muted)]">
          Show
        </span>
        <div className="mt-1 flex flex-col gap-1.5">
          {TOGGLES.map((t) => (
            <label
              key={t.key}
              className="flex items-center gap-2 text-sm text-[var(--color-text)]"
            >
              <input
                type="checkbox"
                checked={block[t.key] !== false}
                onChange={(e) =>
                  onUpdate({ [t.key]: e.target.checked } as Partial<ShotDetailBlock>)
                }
                data-testid={`shot-detail-${t.key}`}
              />
              {t.label}
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}
