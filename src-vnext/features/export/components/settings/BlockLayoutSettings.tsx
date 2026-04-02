import { useCallback, useState } from "react"
import type { BlockLayout } from "../../types/exportBuilder"

const BORDER_STYLE_OPTIONS: readonly {
  readonly value: NonNullable<BlockLayout["borderStyle"]>
  readonly label: string
}[] = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
  { value: "none", label: "None" },
]

export function BlockLayoutSettings({
  layout,
  onUpdate,
}: {
  readonly layout: BlockLayout | undefined
  readonly onUpdate: (layout: BlockLayout) => void
}) {
  const l = layout ?? {}
  const [uniform, setUniform] = useState(true)

  const paddingTop = l.paddingTop ?? 0
  const paddingRight = l.paddingRight ?? 0
  const paddingBottom = l.paddingBottom ?? 0
  const paddingLeft = l.paddingLeft ?? 0
  const borderWidth = l.borderWidth ?? 0
  const borderColor = l.borderColor ?? "#000000"
  const borderStyle = l.borderStyle ?? "solid"
  const borderRadius = l.borderRadius ?? 0
  const backgroundColor = l.backgroundColor ?? ""

  const handlePaddingUniform = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0) return
      onUpdate({
        ...l,
        paddingTop: parsed,
        paddingRight: parsed,
        paddingBottom: parsed,
        paddingLeft: parsed,
      })
    },
    [l, onUpdate],
  )

  const handlePaddingSide = useCallback(
    (side: "paddingTop" | "paddingRight" | "paddingBottom" | "paddingLeft", value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0) return
      onUpdate({ ...l, [side]: parsed })
    },
    [l, onUpdate],
  )

  const handleBorderWidth = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0) return
      onUpdate({ ...l, borderWidth: parsed })
    },
    [l, onUpdate],
  )

  const handleBorderRadius = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 0) return
      onUpdate({ ...l, borderRadius: parsed })
    },
    [l, onUpdate],
  )

  const inputClass =
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
  const labelClass = "text-2xs font-medium text-[var(--color-text-muted)]"

  return (
    <div className="flex flex-col gap-4 border-t border-[var(--color-border)] pt-4 mt-4">
      <p className="text-2xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
        Layout
      </p>

      {/* Padding */}
      <div>
        <div className="flex items-center justify-between">
          <label className={labelClass}>Padding</label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={uniform}
              onChange={() => setUniform(!uniform)}
              className="rounded border-[var(--color-border)]"
            />
            <span className="text-2xs text-[var(--color-text-muted)]">Uniform</span>
          </label>
        </div>
        {uniform ? (
          <input
            type="number"
            min={0}
            max={200}
            value={paddingTop}
            onChange={(e) => handlePaddingUniform(e.target.value)}
            data-testid="layout-padding-uniform"
            className={`mt-1 ${inputClass}`}
          />
        ) : (
          <div className="mt-1 grid grid-cols-2 gap-1.5">
            {(
              [
                ["paddingTop", "Top", paddingTop],
                ["paddingRight", "Right", paddingRight],
                ["paddingBottom", "Bottom", paddingBottom],
                ["paddingLeft", "Left", paddingLeft],
              ] as const
            ).map(([key, label, val]) => (
              <div key={key}>
                <span className="text-3xs text-[var(--color-text-muted)]">{label}</span>
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={val}
                  onChange={(e) => handlePaddingSide(key, e.target.value)}
                  data-testid={`layout-${key}`}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Border */}
      <div>
        <label className={labelClass}>Border</label>
        <div className="mt-1 flex flex-col gap-1.5">
          <div className="flex gap-1.5">
            <div className="flex-1">
              <span className="text-3xs text-[var(--color-text-muted)]">Width</span>
              <input
                type="number"
                min={0}
                max={20}
                value={borderWidth}
                onChange={(e) => handleBorderWidth(e.target.value)}
                data-testid="layout-borderWidth"
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <span className="text-3xs text-[var(--color-text-muted)]">Radius</span>
              <input
                type="number"
                min={0}
                max={50}
                value={borderRadius}
                onChange={(e) => handleBorderRadius(e.target.value)}
                data-testid="layout-borderRadius"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex gap-1.5">
            <div className="flex-1">
              <span className="text-3xs text-[var(--color-text-muted)]">Style</span>
              <select
                value={borderStyle}
                onChange={(e) =>
                  onUpdate({ ...l, borderStyle: e.target.value as BlockLayout["borderStyle"] })
                }
                data-testid="layout-borderStyle"
                className={inputClass}
              >
                {BORDER_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <span className="text-3xs text-[var(--color-text-muted)]">Color</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={borderColor}
                  onChange={(e) => onUpdate({ ...l, borderColor: e.target.value })}
                  data-testid="layout-borderColor"
                  className="h-[34px] w-8 cursor-pointer rounded border border-[var(--color-border)]"
                />
                <span className="text-2xs text-[var(--color-text-muted)]">{borderColor}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Background */}
      <div>
        <label className={labelClass}>Background</label>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="color"
            value={backgroundColor || "#ffffff"}
            onChange={(e) => onUpdate({ ...l, backgroundColor: e.target.value })}
            data-testid="layout-backgroundColor"
            className="h-[34px] w-8 cursor-pointer rounded border border-[var(--color-border)]"
          />
          <span className="text-2xs text-[var(--color-text-muted)]">
            {backgroundColor || "Transparent"}
          </span>
          {backgroundColor && (
            <button
              type="button"
              onClick={() => onUpdate({ ...l, backgroundColor: undefined })}
              data-testid="layout-bg-reset"
              className="text-2xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
