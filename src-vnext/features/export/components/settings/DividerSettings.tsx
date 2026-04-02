import type { DividerBlock } from "../../types/exportBuilder"

export function DividerSettings({
  block,
  onUpdate,
}: {
  readonly block: DividerBlock
  readonly onUpdate: (updates: Partial<DividerBlock>) => void
}) {
  const styleOptions: readonly {
    readonly value: NonNullable<DividerBlock["style"]>
    readonly label: string
  }[] = [
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
