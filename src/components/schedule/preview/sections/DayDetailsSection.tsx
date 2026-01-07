import React from "react";
import type { CallSheetDayDetails } from "../../types";

interface DayDetailsSectionProps {
  data: CallSheetDayDetails;
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  const display = value && String(value).trim() ? String(value).trim() : "—";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
      <div className="font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="font-medium text-gray-800">{display}</div>
    </div>
  );
}

export function DayDetailsSection({ data }: DayDetailsSectionProps) {
  return (
    <div className="divide-y divide-gray-200">
      <Detail label="Crew Call" value={data.crewCallTime ?? null} />
      <Detail label="Shooting Call" value={data.shootingCallTime ?? null} />
      <Detail label="Breakfast" value={data.breakfastTime ?? null} />
      <Detail label="First Meal" value={data.firstMealTime ?? null} />
      <Detail label="Second Meal" value={data.secondMealTime ?? null} />
      <Detail label="Est. Wrap" value={data.estimatedWrap ?? null} />
      {data.weather?.summary ? (
        <div className="px-3 py-2 text-xs">
          <div className="font-semibold uppercase tracking-wide text-gray-500">Weather</div>
          <div className="mt-1 text-gray-700">{String(data.weather.summary)}</div>
        </div>
      ) : null}
    </div>
  );
}

