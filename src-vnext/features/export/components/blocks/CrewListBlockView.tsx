import { useMemo } from "react"
import type { CrewListBlock } from "../../types/exportBuilder"
import { useExportDataContext } from "../ExportDataProvider"
import type { CrewRecord } from "@/shared/types"

interface CrewListBlockViewProps {
  readonly block: CrewListBlock
}

interface DepartmentGroup {
  readonly name: string
  readonly members: readonly CrewRecord[]
}

function groupByDepartment(crew: readonly CrewRecord[]): readonly DepartmentGroup[] {
  const groups = new Map<string, CrewRecord[]>()

  for (const member of crew) {
    const dept = member.department?.trim() || "Other"
    const existing = groups.get(dept)
    if (existing) {
      existing.push(member)
    } else {
      groups.set(dept, [member])
    }
  }

  const sorted = [...groups.entries()].sort(([a], [b]) => {
    if (a === "Other") return 1
    if (b === "Other") return -1
    return a.localeCompare(b)
  })

  return sorted.map(([name, members]) => ({ name, members }))
}

const CREW_COLUMNS = ["Name", "Role", "Phone", "Email"] as const

function CrewTable({ members }: { readonly members: readonly CrewRecord[] }) {
  const hd = "border border-gray-200 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500"
  const td = "border border-gray-200 px-3 py-1.5 text-[10px] text-gray-800"

  return (
    <table
      className="w-full border border-gray-200 text-left"
      style={{ borderCollapse: "separate", borderSpacing: 0 }}
    >
      <thead>
        <tr className="bg-gray-50">
          {CREW_COLUMNS.map((col) => (
            <th key={col} className={hd}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {members.map((member, i) => (
          <tr key={member.id} className={i % 2 === 1 ? "bg-gray-50" : ""}>
            <td className={td}>{member.name}</td>
            <td className={td}>{member.position ?? "\u2014"}</td>
            <td className={td}>{member.phone ?? "\u2014"}</td>
            <td className={td}>{member.email ?? "\u2014"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function CrewListBlockView({ block }: CrewListBlockViewProps) {
  const { crew } = useExportDataContext()

  const shouldGroup = block.groupByDepartment !== false
  const departments = useMemo(
    () => (shouldGroup ? groupByDepartment(crew) : []),
    [crew, shouldGroup],
  )

  if (crew.length === 0) {
    return (
      <div data-testid="crew-list-block" className="py-6 text-center text-[10px] text-gray-400 italic">
        No crew members
      </div>
    )
  }

  return (
    <div data-testid="crew-list-block" className="space-y-4">
      {shouldGroup ? (
        departments.map((dept) => (
          <div key={dept.name}>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              {dept.name}
            </p>
            <CrewTable members={dept.members} />
          </div>
        ))
      ) : (
        <CrewTable members={crew} />
      )}
      <p className="text-[10px] text-gray-500">
        {crew.length} crew {crew.length === 1 ? "member" : "members"}
      </p>
    </div>
  )
}
