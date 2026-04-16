import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react"
import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import {
  DEFAULT_CAST_SECTION,
  FIELD_WIDTH_MAP,
  getVisibleFields,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import { mergeTalentWithOverride } from "@/features/schedules/lib/callSheetMerge"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import type { TalentCallSheet, TalentRecord, DayDetails } from "@/shared/types"

interface CallSheetCastTableProps {
  readonly talentCalls: readonly TalentCallSheet[]
  readonly talentLookup: readonly TalentRecord[]
  readonly dayDetails: DayDetails | null
  readonly fieldConfig?: CallSheetSectionFieldConfig
}

/** Default pixel width when container measurement is unavailable. */
const FALLBACK_TABLE_WIDTH = 800

const NUMERIC_KEYS = new Set(["id", "setCall", "wrap", "notes"])

function formatTime(value: string | null | undefined): string {
  if (!value) return "\u2014"
  return formatHHMMTo12h(value) || value
}

/** Convert a FIELD_WIDTH_MAP percentage string to a pixel value. */
function percentToPixels(percent: string, tableWidth: number): number {
  return Math.round((parseFloat(percent) / 100) * tableWidth)
}

/**
 * Cast / Talent table with editorial section label style.
 * Renders existing data only. Supports per-field customization:
 * rename columns, reorder, resize, and toggle visibility.
 * Includes drag-to-resize column headers and keyboard row navigation.
 */
export function CallSheetCastTable({
  talentCalls,
  talentLookup,
  dayDetails,
  fieldConfig,
}: CallSheetCastTableProps) {
  const talentMap = useMemo(() => {
    const map = new Map<string, TalentRecord>()
    for (const t of talentLookup) map.set(t.id, t)
    return map
  }, [talentLookup])

  const config = fieldConfig ?? DEFAULT_CAST_SECTION
  const visibleFields = useMemo(() => getVisibleFields(config.fields), [config.fields])

  const visibleTalentCalls = useMemo(
    () => talentCalls.filter((tc) => mergeTalentWithOverride(tc).isVisible),
    [talentCalls],
  )

  // --- Container measurement for percentage → pixel conversion ---
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(FALLBACK_TABLE_WIDTH)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const w = el.clientWidth
      if (w > 0) setContainerWidth(w)
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // --- Column resize ---
  const [resizeWidths, setResizeWidths] = useState<Record<string, number>>({})

  const handleWidthChange = useCallback((key: string, width: number) => {
    setResizeWidths((prev) => ({ ...prev, [key]: width }))
  }, [])

  const { startResize } = useColumnResize({ onWidthChange: handleWidthChange })

  /** Resolve the pixel width for a field: resize override or percentage-based default. */
  const resolveWidth = useCallback(
    (key: string, presetPercent: string): number => {
      return resizeWidths[key] ?? percentToPixels(presetPercent, containerWidth)
    },
    [resizeWidths, containerWidth],
  )

  // --- Keyboard navigation ---
  const tableRef = useRef<HTMLTableElement>(null)
  const { onTableKeyDown } = useTableKeyboardNav({
    tableRef,
    rowCount: visibleTalentCalls.length,
  })

  if (visibleTalentCalls.length === 0) {
    return (
      <p className="py-2 text-xs text-[var(--color-text-subtle)]">
        No talent call times set.
      </p>
    )
  }

  const shootingCall = dayDetails?.shootingCallTime ?? null

  return (
    <div ref={containerRef} className="callsheet-table-wrap">
      <table
        ref={tableRef}
        tabIndex={0}
        onKeyDown={onTableKeyDown}
        className="callsheet-cs-table"
      >
        <thead>
          <tr>
            {visibleFields.map((field) => {
              const isNumeric = NUMERIC_KEYS.has(field.key)
              const pixelWidth = resolveWidth(field.key, FIELD_WIDTH_MAP[field.width])
              return (
                <ResizableHeader
                  key={field.key}
                  columnKey={field.key}
                  width={pixelWidth}
                  onStartResize={startResize}
                  className={isNumeric ? "text-right" : undefined}
                >
                  {field.label}
                </ResizableHeader>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {visibleTalentCalls.map((tc, idx) => {
            const talent = talentMap.get(tc.talentId)
            const displayName = talent?.name ?? tc.talentId
            const callTime = tc.callTime ?? tc.callText ?? shootingCall
            const wrapTime = tc.wrapTime ?? null
            const isEven = idx % 2 === 1

            const cellValues: Record<string, React.ReactNode> = {
              id: (
                <td key="id" className="text-center" style={{ fontWeight: 600, fontSize: "10px" }}>
                  {idx + 1}
                </td>
              ),
              talent: (
                <td key="talent" style={{ fontWeight: 600 }}>{displayName}</td>
              ),
              role: (
                <td key="role">{tc.role ?? "\u2014"}</td>
              ),
              setCall: (
                <td key="setCall" className="text-right" style={{ fontWeight: 600 }}>
                  {formatTime(callTime)}
                </td>
              ),
              wrap: (
                <td key="wrap" className="text-right">{formatTime(wrapTime)}</td>
              ),
              notes: (
                <td key="notes" className="text-right">
                  {tc.notes ? (
                    <span className="text-[var(--color-text-muted)]">{tc.notes}</span>
                  ) : (
                    "\u2014"
                  )}
                </td>
              ),
            }

            return (
              <tr key={tc.id} className={`${isEven ? "callsheet-row-even" : "callsheet-row-odd"} data-[active-row]:bg-[var(--color-primary)]/5`}>
                {visibleFields.map((field) => cellValues[field.key] ?? <td key={field.key}>{"\u2014"}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
