import React from "react";
import { Flag } from "lucide-react";
import { cn } from "../../../../lib/utils";
import type { CallSheetScheduleItem } from "../../types";

interface ScheduleTableSectionProps {
  schedule: CallSheetScheduleItem[];
}

export function ScheduleTableSection({ schedule }: ScheduleTableSectionProps) {
  if (!schedule.length) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 italic">
        No schedule items.
      </div>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="bg-[#2a3f5f] text-white">
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide w-20 border-r border-[#3d5a80]">
            Time
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide border-r border-[#3d5a80]">
            Set / Description
          </th>
          <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide w-16 border-r border-[#3d5a80]">
            Cast
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide w-44 border-r border-[#3d5a80]">
            Notes
          </th>
          <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide w-40">
            Location
          </th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((item, index) => (
          <tr
            key={item.id}
            className={cn(
              "border-b border-gray-200",
              index % 2 === 0 ? "bg-white" : "bg-gray-50/60"
            )}
          >
            {/* Time Column */}
            <td className="px-3 py-2.5 align-top border-r border-gray-200">
              <div className="font-semibold text-gray-900">{item.time}</div>
              {item.duration && (
                <div className="text-[10px] text-gray-400 italic">{item.duration}</div>
              )}
            </td>

            {/* Banner Row (spans multiple columns) */}
            {item.isBanner ? (
              <td colSpan={4} className="px-3 py-2.5">
                <div className="flex items-center gap-2 font-medium text-gray-800">
                  <Flag className="w-4 h-4 text-red-500" />
                  {item.description}
                </div>
              </td>
            ) : (
              <>
                {/* Set / Description */}
                <td className="px-3 py-2.5 border-r border-gray-200 text-gray-800">
                  {item.description}
                </td>

                {/* Cast */}
                <td className="px-3 py-2.5 text-center border-r border-gray-200 text-gray-700">
                  {item.cast !== "—" ? item.cast : ""}
                </td>

                {/* Notes */}
                <td className="px-3 py-2.5 border-r border-gray-200 text-xs text-gray-600">
                  {item.notes !== "—" ? item.notes : ""}
                </td>

                {/* Location */}
                <td className="px-3 py-2.5 text-xs">
                  {item.location ? (
                    <>
                      <div className="font-medium text-gray-900">{item.location.name}</div>
                      {item.location.address && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(item.location.address)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {item.location.address}
                        </a>
                      )}
                    </>
                  ) : null}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
