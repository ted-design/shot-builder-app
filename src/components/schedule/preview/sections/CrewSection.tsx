import React from "react";
import { cn } from "../../../../lib/utils";
import type { CallSheetCrewRow } from "../../types";

interface CrewSectionProps {
  crew: CallSheetCrewRow[];
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

export function CrewSection({ crew }: CrewSectionProps) {
  if (!crew.length) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 italic">
        No crew.
      </div>
    );
  }

  const groupedCrew = groupByDepartment(crew);
  const departments = Array.from(groupedCrew.keys());

  return (
    <div className="space-y-4">
      {departments.map((department) => {
        const members = groupedCrew.get(department) || [];
        return (
          <div key={department}>
            {/* Department Header */}
            <div className="bg-[#2a3f5f] text-white px-3 py-2">
              <span className="text-xs font-bold uppercase tracking-wide">
                {department}
              </span>
            </div>

            {/* Crew Table for this department */}
            <table className="w-full text-sm border-collapse border border-t-0 border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-32">
                    Role
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200">
                    Name
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200 w-32">
                    Phone
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-gray-700 uppercase tracking-wide border-r border-gray-200">
                    Email
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-gray-700 uppercase tracking-wide w-20">
                    Call
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member, idx) => (
                  <tr
                    key={member.id}
                    className={cn(
                      "border-b border-gray-200",
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                    )}
                  >
                    <td className="px-3 py-2 text-gray-600 border-r border-gray-200 text-xs">
                      {/* Role - could be derived from department or stored separately */}
                      {member.notes || department}
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-200">
                      {member.name}
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                      {/* Phone - placeholder, would need to be added to data model */}
                      <a href="#" className="text-blue-600 hover:underline">
                        —
                      </a>
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                      {/* Email - placeholder, would need to be added to data model */}
                      —
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 text-xs">
                      {member.callTime || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
