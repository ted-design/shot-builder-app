import { useMemo } from "react"
import { formatHHMMTo12h } from "@/features/schedules/lib/time"
import type { CrewCallSheet, CrewRecord, DayDetails } from "@/shared/types"

interface CallSheetDeptGridProps {
  readonly crewCalls: readonly CrewCallSheet[]
  readonly crewLookup: readonly CrewRecord[]
  readonly dayDetails: DayDetails | null
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

function DeptBlock({ group, totalCount }: { readonly group: DeptGroup; readonly totalCount: number }) {
  return (
    <div className="callsheet-dept-block">
      <div className="callsheet-dept-header">
        <span>{group.department}</span>
        <span className="callsheet-dept-count">{group.members.length}</span>
      </div>
      <table className="callsheet-cs-table">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Position</th>
            <th style={{ width: "46%" }}>Name</th>
            <th style={{ width: "14%" }} className="text-right">Call</th>
          </tr>
        </thead>
        <tbody>
          {group.members.map((member, idx) => (
            <tr key={member.id} className={idx % 2 === 1 ? "callsheet-row-even" : "callsheet-row-odd"}>
              <td>{member.position || "\u2014"}</td>
              <td style={{ fontWeight: 500 }}>{member.name}</td>
              <td className="text-right" style={{ fontWeight: 600 }}>{member.callTime}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Crew grid grouped by department with editorial section labels.
 * Light gray table headers (not black full-bleed bands per S7-7 spec).
 * Department blocks use dark header rows for visual grouping.
 * Print-safe: each dept block avoids page breaks inside.
 */
export function CallSheetDeptGrid({
  crewCalls,
  crewLookup,
  dayDetails,
}: CallSheetDeptGridProps) {
  const crewMap = useMemo(() => {
    const m = new Map<string, CrewRecord>()
    for (const c of crewLookup) m.set(c.id, c)
    return m
  }, [crewLookup])

  const groups = useMemo(
    () => groupByDepartment(crewCalls, crewMap, dayDetails?.crewCallTime ?? null),
    [crewCalls, crewMap, dayDetails],
  )

  const totalCount = crewCalls.length

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
        <DeptBlock key={group.department} group={group} totalCount={totalCount} />
      ))}
    </div>
  )
}
