import React from "react";
import type { CallSheetCrewRow } from "../../types";
import { DocSectionHeader } from "../primitives/DocSectionHeader";
import { DocTable } from "../primitives/DocTable";

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
                  // Type assertion for future phone/email fields
                  const phone = (member as { phone?: string }).phone;
                  const email = (member as { email?: string }).email;
                  const hasContact = phone || email;

                  return (
                    <tr key={member.id} style={{ height: "auto", minHeight: "28px" }}>
                      <td className="align-top">
                        {member.notes || department}
                      </td>
                      <td className="align-top">
                        {/* Primary: Name */}
                        <div className="font-medium">{member.name}</div>
                        {/* Secondary: Contact info (when available) */}
                        {hasContact && (
                          <div className="text-[10px] leading-tight">
                            {phone && (
                              <a
                                href={`tel:${phone}`}
                                className="text-blue-600 hover:underline"
                              >
                                {phone}
                              </a>
                            )}
                            {phone && email && (
                              <span className="text-gray-400 mx-1">·</span>
                            )}
                            {email && (
                              <a
                                href={`mailto:${email}`}
                                className="text-blue-600 hover:underline"
                              >
                                {email}
                              </a>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="text-right align-top">
                        {member.callTime || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DocTable>
          </div>
        );
      })}
    </div>
  );
}
