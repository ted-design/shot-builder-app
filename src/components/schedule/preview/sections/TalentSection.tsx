import React from "react";
import type { CallSheetTalentRow } from "../../types";
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

interface TalentSectionProps {
  talent: CallSheetTalentRow[];
}

export function TalentSection({ talent }: TalentSectionProps) {
  return (
    <DocTable>
      <thead>
        <tr>
          <th className="text-left">
            ID
          </th>
          <th className="text-left">
            Talent
          </th>
          <th className="text-left">
            Role
          </th>
          <th className="text-left">
            Status
          </th>
          <th className="text-left">
            Transpo
          </th>
          <th className="text-left">
            Call
          </th>
          <th className="text-left">
            BLK/RHS
          </th>
          <th className="text-left">
            MU/Ward
          </th>
          <th className="text-left">
            Set
          </th>
          <th className="text-left">
            Remarks
          </th>
        </tr>
      </thead>
      <tbody>
        {talent.length === 0 ? (
          <tr>
            <td colSpan={10} className="py-4 text-center text-sm text-gray-500 italic">
              No talent today!
            </td>
          </tr>
        ) : (
          talent.map((row, idx) => (
            <tr key={row.id}>
              <td className="text-gray-700 text-xs">
                {idx + 1}
              </td>
              <td className="font-medium text-gray-900">
                {row.name}
              </td>
              <td className="text-gray-700 text-xs">
                {row.role || ""}
              </td>
              <td className="text-gray-700 text-xs">
                {row.status || ""}
              </td>
              <td className="text-gray-700 text-xs">
                {/* Transpo placeholder */}
              </td>
              <td className="text-gray-700 text-xs whitespace-nowrap">
                {formatTime12h(row.callTime) || ""}
              </td>
              <td className="text-gray-700 text-xs">
                {/* BLK/RHS placeholder */}
              </td>
              <td className="text-gray-700 text-xs">
                {/* MU/Ward placeholder */}
              </td>
              <td className="text-gray-700 text-xs">
                {/* Set placeholder */}
              </td>
              <td className="text-xs text-gray-600">
                {row.notes || ""}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </DocTable>
  );
}
