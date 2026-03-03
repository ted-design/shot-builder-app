import { useState } from "react"
import { ChevronDown, Phone } from "lucide-react"
import type { CrewRecord } from "@/shared/types"

const DEPT_ACCENT_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#E31E24",
  "#10b981",
  "#71717a",
  "#ec4899",
  "#0ea5e9",
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase()
}

function getDeptColor(dept: string, allDepts: string[]): string {
  const idx = allDepts.indexOf(dept)
  return DEPT_ACCENT_COLORS[idx % DEPT_ACCENT_COLORS.length] ?? "#71717a"
}

interface CrewRowProps {
  member: CrewRecord
  accentColor: string
  isLast: boolean
}

function CrewRow({ member, accentColor, isLast }: CrewRowProps) {
  const initials = getInitials(member.name)
  const phone = member.phone ?? null

  function handleCall() {
    if (phone) {
      window.open(`tel:${phone}`)
    }
  }

  return (
    <div
      className={`flex items-center gap-3 py-2.5 ${isLast ? "" : "border-b border-[var(--color-border)]"}`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-3xs font-semibold text-white flex-shrink-0"
        style={{ background: accentColor }}
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] truncate">{member.name}</p>
        <p className="text-xs text-[var(--color-text-muted)] truncate">
          {member.position ?? member.department ?? ""}
        </p>
      </div>
      {phone && (
        <button
          type="button"
          className="w-8 h-8 rounded-full bg-[var(--color-surface-subtle)] flex items-center justify-center flex-shrink-0"
          onClick={handleCall}
          aria-label={`Call ${member.name}`}
        >
          <Phone className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
        </button>
      )}
    </div>
  )
}

interface DeptGroupProps {
  department: string
  members: CrewRecord[]
  accentColor: string
}

function DeptGroup({ department, members, accentColor }: DeptGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 h-11 transition-colors active:bg-[var(--color-surface-subtle)]"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-0.5 h-5 rounded-full flex-shrink-0"
            style={{ background: accentColor }}
          />
          <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text)]">
            {department}
          </span>
          <span className="text-3xs text-[var(--color-text-muted)]">{members.length}</span>
        </div>
        <ChevronDown
          className="w-3.5 h-3.5 text-[var(--color-text-muted)] transition-transform duration-200"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        />
      </button>

      {/*
        grid-template-rows: 0fr → 1fr avoids the max-height animation clipping trap.
        Inner div needs overflow:hidden and min-height:0 for this to work correctly.
        This handles arbitrarily large crew lists without clipping.
      */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: open ? "1fr" : "0fr",
          transition: "grid-template-rows 250ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div style={{ overflow: "hidden", minHeight: 0 }}>
          <div className="px-4 pb-3 border-t border-[var(--color-border)]">
            {members.map((member, idx) => (
              <CrewRow
                key={member.id}
                member={member}
                accentColor={accentColor}
                isLast={idx === members.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface OnSetCrewTabProps {
  crewLibrary: CrewRecord[]
}

export function OnSetCrewTab({ crewLibrary }: OnSetCrewTabProps) {
  const grouped = crewLibrary.reduce<Record<string, CrewRecord[]>>((acc, member) => {
    const dept = member.department ?? "Other"
    return {
      ...acc,
      [dept]: [...(acc[dept] ?? []), member],
    }
  }, {})

  const departments = Object.keys(grouped).sort()

  if (departments.length === 0) {
    return (
      <div className="px-4 pt-6 pb-3">
        <h3 className="heading-subsection mb-3">Crew</h3>
        <p className="text-sm text-[var(--color-text-muted)] py-6 text-center">
          No crew assigned.
        </p>
      </div>
    )
  }

  const totalCount = crewLibrary.length

  return (
    <div className="px-4 pt-6 pb-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="heading-subsection">Crew</h3>
        <span className="text-2xs text-[var(--color-text-muted)]">
          {totalCount} {totalCount === 1 ? "member" : "members"}
        </span>
      </div>

      <div className="space-y-2">
        {departments.map((dept) => (
          <DeptGroup
            key={dept}
            department={dept}
            members={grouped[dept] ?? []}
            accentColor={getDeptColor(dept, departments)}
          />
        ))}
      </div>
    </div>
  )
}
