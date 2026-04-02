import { Text, View } from "@react-pdf/renderer"
import type { CrewListBlock } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { CrewRecord } from "@/shared/types"
import { styles } from "../pdfStyles"

interface CrewListBlockPdfProps {
  readonly block: CrewListBlock
  readonly data: ExportData
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

  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === "Other") return 1
      if (b === "Other") return -1
      return a.localeCompare(b)
    })
    .map(([name, members]) => ({ name, members }))
}

const HEADERS = ["Name", "Role", "Phone", "Email"] as const

function CrewTablePdf({ members }: { readonly members: readonly CrewRecord[] }) {
  return (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        {HEADERS.map((h) => (
          <Text key={h} style={{ ...styles.tableHeaderCell, flex: 1 }}>{h}</Text>
        ))}
      </View>
      {members.map((m, i) => (
        <View
          key={m.id}
          wrap={false}
          style={i % 2 === 1 ? styles.tableRowStriped : styles.tableRow}
        >
          <Text style={{ ...styles.tableCell, flex: 1 }}>{m.name}</Text>
          <Text style={{ ...styles.tableCell, flex: 1 }}>{m.position ?? "\u2014"}</Text>
          <Text style={{ ...styles.tableCell, flex: 1 }}>{m.phone ?? "\u2014"}</Text>
          <Text style={{ ...styles.tableCell, flex: 1 }}>{m.email ?? "\u2014"}</Text>
        </View>
      ))}
    </View>
  )
}

export function CrewListBlockPdf({ block, data }: CrewListBlockPdfProps) {
  if (data.crew.length === 0) return null

  const shouldGroup = block.groupByDepartment !== false

  if (!shouldGroup) {
    return <CrewTablePdf members={data.crew} />
  }

  const departments = groupByDepartment(data.crew)

  return (
    <View>
      {departments.map((dept) => (
        <View key={dept.name}>
          <Text style={styles.sectionLabel}>{dept.name}</Text>
          <CrewTablePdf members={dept.members} />
        </View>
      ))}
    </View>
  )
}
