import React from "react";
import { Flag } from "lucide-react";
import type { CallSheetScheduleItem } from "../../types";
import { DocTable } from "../primitives/DocTable";

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
    <DocTable>
      <thead>
        <tr>
          <th className="text-left w-20">
            Time
          </th>
          <th className="text-left">
            Set / Description
          </th>
          <th className="text-center w-16">
            Cast
          </th>
          <th className="text-left w-44">
            Notes
          </th>
          <th className="text-left w-40">
            Location
          </th>
        </tr>
      </thead>
      <tbody>
        {schedule.map((item) => (
          <tr key={item.id}>
            {/* Time Column */}
            <td>
              <div className="font-semibold text-gray-900">{item.time}</div>
              {item.duration && (
                <div className="text-[10px] text-gray-400 italic">{item.duration}</div>
              )}
            </td>

            {/* Banner Row (spans multiple columns) */}
            {item.isBanner ? (
              <td colSpan={4}>
                <div className="flex items-center gap-2 font-medium text-gray-800">
                  <Flag className="w-4 h-4 text-red-500" />
                  {item.description}
                </div>
              </td>
            ) : (
              <>
                {/* Set / Description */}
                <td className="text-gray-800">
                  {item.description}
                </td>

                {/* Cast */}
                <td className="text-center text-gray-700">
                  {item.cast !== "—" ? item.cast : ""}
                </td>

                {/* Notes */}
                <td className="text-xs text-gray-600">
                  {item.notes !== "—" ? item.notes : ""}
                </td>

                {/* Location */}
                <td className="text-xs">
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
    </DocTable>
  );
}
