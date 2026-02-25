import React from "react";
import type { CallSheetCrewRow } from "../../types";
import { DocSectionHeader } from "../primitives/DocSectionHeader";
import { DocTable } from "../primitives/DocTable";

/**
 * Format time string from HH:MM (24h) to h:mm AM/PM format.
 */
function formatTime12h(value: string | null | undefined): string {
  if (!value || typeof value !== "string") return "";
  const [hRaw, mRaw] = value.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

interface DisplayOptions {
  showEmails?: boolean;
  showPhones?: boolean;
  columnCount?: "auto" | "1" | "2";
  departmentOrder?: string[] | null;
}

interface CrewSectionProps {
  crew: CallSheetCrewRow[];
  displayOptions?: DisplayOptions;
}

// Group crew by department
function groupByDepartment(crew: CallSheetCrewRow[]): Map<string, CallSheetCrewRow[]> {
  const groups = new Map<string, CallSheetCrewRow[]>();

  for (const member of crew) {
    const dept = member.department || "Other";
    if (!groups.has(dept)) {
      groups.set(dept, []);
    }
    groups.get(dept)!.push(member);
  }

  return groups;
}

// --- Wrap-aware 2-column balancing allocator ---

// Weight constants for department block height estimation
const HEADER_WEIGHT = 2;
const ROW_WEIGHT = 1;
const WRAP_PENALTY = 1;

// Thresholds for text wrapping heuristic
const DEPT_NAME_WRAP_THRESHOLD = 18;
const ROLE_WRAP_THRESHOLD = 22;
const EMAIL_WRAP_THRESHOLD = 28;

interface DepartmentWithWeight {
  name: string;
  members: CallSheetCrewRow[];
  weight: number;
}

/**
 * Calculate weight for a department block based on row count and wrap potential.
 * Higher weight = more vertical space consumed.
 */
function calculateDepartmentWeight(
  deptName: string,
  members: CallSheetCrewRow[]
): number {
  let weight = HEADER_WEIGHT + members.length * ROW_WEIGHT;

  // Penalty for long department name that may wrap
  if (deptName.length > DEPT_NAME_WRAP_THRESHOLD) {
    weight += WRAP_PENALTY;
  }

  // Penalty for long role/title or email that may wrap
  for (const member of members) {
    const role = member.role || member.notes || deptName;
    if (role.length > ROLE_WRAP_THRESHOLD) {
      weight += WRAP_PENALTY;
    }
    const email = (member as { email?: string }).email;
    if (email && email.length > EMAIL_WRAP_THRESHOLD) {
      weight += WRAP_PENALTY;
    }
  }

  return weight;
}

/**
 * Greedy allocator: distribute departments into two columns to minimize height imbalance.
 * Preserves manual department order as allocation order.
 */
function allocateTwoColumns(
  orderedDepartments: string[],
  groupedCrew: Map<string, CallSheetCrewRow[]>
): { leftCol: DepartmentWithWeight[]; rightCol: DepartmentWithWeight[] } {
  const leftCol: DepartmentWithWeight[] = [];
  const rightCol: DepartmentWithWeight[] = [];
  let leftWeight = 0;
  let rightWeight = 0;

  for (const deptName of orderedDepartments) {
    const members = groupedCrew.get(deptName) || [];
    const weight = calculateDepartmentWeight(deptName, members);

    if (leftWeight <= rightWeight) {
      leftCol.push({ name: deptName, members, weight });
      leftWeight += weight;
    } else {
      rightCol.push({ name: deptName, members, weight });
      rightWeight += weight;
    }
  }

  return { leftCol, rightCol };
}

/**
 * Get effective column count based on setting and viewport width.
 * Auto heuristic: 2 columns if viewport is wide (>= 1200px), otherwise 1.
 * Note: 3-column mode is disabled due to CSS column layout limitations.
 */
function getEffectiveColumnCount(columnCount: DisplayOptions["columnCount"] | "3"): number {
  if (columnCount === "1") return 1;
  // Coerce "3" → 2 since 3-column layout is disabled
  if (columnCount === "2" || columnCount === "3") return 2;
  // Auto: use 2 columns on wide viewports, 1 on narrow
  if (typeof window !== "undefined" && window.innerWidth >= 1200) {
    return 2;
  }
  return 1;
}

export function CrewSection({ crew, displayOptions }: CrewSectionProps) {
  if (!crew.length) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 italic">
        No crew.
      </div>
    );
  }

  const groupedCrew = groupByDepartment(crew);
  const rawDepartments = Array.from(groupedCrew.keys());

  // Apply custom department ordering if provided
  const departmentOrder = displayOptions?.departmentOrder;
  let departments: string[];
  if (departmentOrder && departmentOrder.length > 0) {
    // Sort departments according to stored order
    // Departments in the order come first, then any new ones appended at the end
    const normalizedOrder = departmentOrder.map((d) => d.toUpperCase());
    const sortedDepts: string[] = [];
    const unorderedDepts: string[] = [];

    for (const dept of rawDepartments) {
      const normalizedDept = dept.toUpperCase();
      const orderIndex = normalizedOrder.indexOf(normalizedDept);
      if (orderIndex !== -1) {
        // Will sort these by their index later
        sortedDepts.push(dept);
      } else {
        // Department not in stored order - append at end
        unorderedDepts.push(dept);
      }
    }

    // Sort the known departments by their position in the stored order
    sortedDepts.sort((a, b) => {
      const aIndex = normalizedOrder.indexOf(a.toUpperCase());
      const bIndex = normalizedOrder.indexOf(b.toUpperCase());
      return aIndex - bIndex;
    });

    departments = [...sortedDepts, ...unorderedDepts];
  } else {
    departments = rawDepartments;
  }

  const showPhones = displayOptions?.showPhones ?? false;
  const showEmails = displayOptions?.showEmails ?? false;
  const columnCount = getEffectiveColumnCount(displayOptions?.columnCount);

  // Helper to render a single department block
  const renderDepartmentBlock = (department: string, members: CallSheetCrewRow[], isMultiColumn: boolean) => (
    <div key={department} className={isMultiColumn ? "mb-4" : "mb-4"}>
      {/* Department Header */}
      <DocSectionHeader title={department} caps variant="boxed" />

      {/* Crew Table for this department */}
      <DocTable>
        <thead>
          <tr>
            <th className="text-left" style={{ width: "30%" }}>
              Role
            </th>
            <th className="text-left">
              Name
            </th>
            <th className="text-right" style={{ width: "15%" }}>
              Call
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            // Read phone/email from member data
            const phone = (member as { phone?: string }).phone;
            const email = (member as { email?: string }).email;
            // Only show contact info if enabled via displayOptions AND data exists
            const visiblePhone = showPhones && phone;
            const visibleEmail = showEmails && email;
            const hasVisibleContact = visiblePhone || visibleEmail;

            return (
              <tr key={member.id} style={{ height: "auto", minHeight: "28px" }}>
                <td className="align-top">
                  {member.role || member.notes || department}
                </td>
                <td className="align-top">
                  {/* Primary: Name */}
                  <div className="font-medium">{member.name}</div>
                  {/* Secondary: Contact info (when enabled and available) */}
                  {hasVisibleContact && (
                    <div className="text-2xs leading-tight text-gray-500">
                      {visiblePhone && (
                        <a
                          href={`tel:${phone}`}
                          className="hover:text-gray-700 hover:underline"
                        >
                          {phone}
                        </a>
                      )}
                      {visiblePhone && visibleEmail && (
                        <span className="mx-1">·</span>
                      )}
                      {visibleEmail && (
                        <a
                          href={`mailto:${email}`}
                          className="hover:text-gray-700 hover:underline"
                        >
                          {email}
                        </a>
                      )}
                    </div>
                  )}
                </td>
                <td className="text-right align-top whitespace-nowrap">
                  <div className="flex flex-col items-end">
                    <span>{formatTime12h(member.callTime) || "—"}</span>
                    {member.isPrevDay && (
                      <span className="text-3xs text-amber-600 font-medium leading-none">
                        Prev day
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </DocTable>
    </div>
  );

  // --- 2-Column Mode: Use wrap-aware balancing allocator ---
  if (columnCount === 2) {
    const { leftCol, rightCol } = allocateTwoColumns(departments, groupedCrew);

    return (
      <div className="grid grid-cols-2 gap-x-4">
        {/* Left Column */}
        <div>
          {leftCol.map((dept) => renderDepartmentBlock(dept.name, dept.members, true))}
        </div>
        {/* Right Column */}
        <div>
          {rightCol.map((dept) => renderDepartmentBlock(dept.name, dept.members, true))}
        </div>
      </div>
    );
  }

  // --- 1-Column Mode: Simple stacked layout ---
  return (
    <div>
      {departments.map((department) => {
        const members = groupedCrew.get(department) || [];
        return renderDepartmentBlock(department, members, false);
      })}
    </div>
  );
}
