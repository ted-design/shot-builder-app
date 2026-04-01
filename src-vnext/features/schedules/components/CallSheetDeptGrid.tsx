import { useMemo } from "react"
import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import {
  DEFAULT_CREW_SECTION,
  FIELD_WIDTH_MAP,
  getVisibleFields,
  type CallSheetFieldConfig,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import type { CrewCallSheet, CrewRecord, DayDetails } from "@/shared/types"

interface CallSheetDeptGridProps {
  readonly crewCalls: readonly CrewCallSheet[]
  readonly crewLookup: readonly CrewRecord[]
  readonly dayDetails: DayDetails | null
  readonly fieldConfig?: CallSheetSectionFieldConfig
}

interface DeptGroup {
  readonly department: string
  readonly members: readonly DeptMember[]
}

interface DeptMember {
  readonly id: string
  readonly name: string
  readonly position: string
  readonly callTime: string
}

function formatTime(value: string | null | undefined): string {
  if (!value) return "\u2014"
  return formatHHMMTo12h(value) || value
}

function groupByDepartment(
  crewCalls: readonly CrewCallSheet[],
  crewMap: Map<string, CrewRecord>,
  defaultCallTime: string | null,
): readonly DeptGroup[] {
  const deptMap = new Map<string, DeptMember[]>()

  for (const cc of crewCalls) {
    const crew = crewMap.get(cc.crewMemberId)
    const dept = (cc.department ?? crew?.department ?? "Other").trim() || "Other"
    const position = (cc.position ?? crew?.position ?? "").trim()
    const name = (crew?.name ?? cc.crewMemberId).trim()
    const callTime = formatTime(cc.callTime ?? cc.callText ?? defaultCallTime)

    const existing = deptMap.get(dept) ?? []
    deptMap.set(dept, [
      ...existing,
      { id: cc.id, name, position, callTime },
    ])
  }

  const groups: DeptGroup[] = []
  for (const [department, members] of deptMap) {
    groups.push({ department, members })
  }

  return groups.sort((a, b) => a.department.localeCompare(b.department))
}

function DeptBlock({
  group,
  visibleFields,
}: {
  readonly group: DeptGroup
  readonly visibleFields: readonly CallSheetFieldConfig[]
}) {
  return (
    <div className="callsheet-dept-block">
      <div className="callsheet-dept-header">
        <span>{group.department}</span>
        <span className="callsheet-dept-count">{group.members.length}</span>
      </div>
      <table className="callsheet-cs-table">
        <thead>
          <tr>
            {visibleFields.map((field) => (
              <th
                key={field.key}
                style={{ width: FIELD_WIDTH_MAP[field.width] }}
                className={field.key === "callTime" ? "text-right" : undefined}
              >
                {field.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {group.members.map((member, idx) => {
            const cellValues: Record<string, React.ReactNode> = {
              position: <td key="position">{member.position || "\u2014"}</td>,
              name: <td key="name" style={{ fontWeight: 500 }}>{member.name}</td>,
              callTime: (
                <td key="callTime" className="text-right" style={{ fontWeight: 600 }}>
                  {member.callTime}
                </td>
              ),
            }

            return (
              <tr key={member.id} className={idx % 2 === 1 ? "callsheet-row-even" : "callsheet-row-odd"}>
                {visibleFields.map((field) => cellValues[field.key] ?? <td key={field.key}>{"\u2014"}</td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Crew grid grouped by department with editorial section labels.
 * Supports per-field customization: rename, reorder, resize, toggle visibility.
 */
export function CallSheetDeptGrid({
  crewCalls,
  crewLookup,
  dayDetails,
  fieldConfig,
}: CallSheetDeptGridProps) {
  const config = fieldConfig ?? DEFAULT_CREW_SECTION

  const crewMap = useMemo(() => {
    const m = new Map<string, CrewRecord>()
    for (const c of crewLookup) m.set(c.id, c)
    return m
  }, [crewLookup])

  const groups = useMemo(
    () => groupByDepartment(crewCalls, crewMap, dayDetails?.crewCallTime ?? null),
    [crewCalls, crewMap, dayDetails],
  )

  const visibleFields = useMemo(() => getVisibleFields(config.fields), [config.fields])

  if (groups.length === 0) {
    return (
      <p className="py-2 text-xs text-[var(--color-text-subtle)]">
        No crew call times set.
      </p>
    )
  }

  return (
    <div className="callsheet-crew-grid">
      {groups.map((group) => (
        <DeptBlock
          key={group.department}
          group={group}
          visibleFields={visibleFields}
        />
      ))}
    </div>
  )
}
