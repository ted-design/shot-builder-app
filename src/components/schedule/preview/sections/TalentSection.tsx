import React from "react";
import { cn } from "../../../../lib/utils";
import type { CallSheetTalentRow } from "../../types";

interface TalentSectionProps {
  talent: CallSheetTalentRow[];
}

export function TalentSection({ talent }: TalentSectionProps) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-[#2a3f5f] text-white">
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            ID
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Talent
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Role
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Status
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Transpo
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Call
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            BLK/RHS
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            MU/Ward
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Set
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide">
            Remarks
          </th>
        </tr>
      </thead>
      <tbody>
        {talent.length === 0 ? (
          <tr>
            <td colSpan={10} className="px-3 py-4 text-center text-sm text-gray-500 italic">
              No talent today!
            </td>
          </tr>
        ) : (
          talent.map((row, idx) => (
            <tr
              key={row.id}
              className={cn(
                "border-b border-gray-200",
                idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
              )}
            >
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {idx + 1}
              </td>
              <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-200">
                {row.name}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {row.role || ""}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {row.status || ""}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {/* Transpo placeholder */}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {row.callTime || ""}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {/* BLK/RHS placeholder */}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {/* MU/Ward placeholder */}
              </td>
              <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                {/* Set placeholder */}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600">
                {row.notes || ""}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
