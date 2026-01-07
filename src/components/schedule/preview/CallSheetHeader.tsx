import React from "react";

type CenterShape = "none" | "circle" | "rectangle";

interface CallSheetHeaderProps {
  projectName: string;
  version: string;
  groupName: string;
  shootDay: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  crewCallTime: string | null;
  centerShape?: CenterShape;
}

interface CallSheetHeaderCompactProps {
  projectName: string;
  version: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  crewCallTime: string | null;
  centerShape?: CenterShape;
}

function formatCrewCall(time: string | null) {
  if (!time) return { time: "--:--", period: "" };
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { time: "--:--", period: "" };
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return {
    time: `${hour12}:${m.toString().padStart(2, "0")}`,
    period,
  };
}

/**
 * Get shape classes based on centerShape prop
 */
function getShapeClasses(shape: CenterShape = "circle"): string {
  switch (shape) {
    case "circle":
      return "w-24 h-24 rounded-full border border-gray-300";
    case "rectangle":
      return "w-28 h-20 rounded-lg border border-gray-300";
    case "none":
      return "w-24 h-24"; // No border, just spacing
    default:
      return "w-24 h-24 rounded-full border border-gray-300";
  }
}

function getCompactShapeClasses(shape: CenterShape = "circle"): string {
  switch (shape) {
    case "circle":
      return "w-16 h-16 rounded-full border border-gray-300";
    case "rectangle":
      return "w-20 h-14 rounded-lg border border-gray-300";
    case "none":
      return "w-16 h-16"; // No border, just spacing
    default:
      return "w-16 h-16 rounded-full border border-gray-300";
  }
}

/**
 * Full header for Page 1 - SetHero style with 3-column layout
 */
export function CallSheetHeader({
  projectName,
  version,
  groupName,
  date,
  dayNumber,
  totalDays,
  crewCallTime,
  centerShape = "circle",
}: CallSheetHeaderProps) {
  const { time, period } = formatCrewCall(crewCallTime);

  return (
    <header className="mb-6">
      {/* Use CSS Grid for proper centering of center column */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        {/* Left Column - Project Info */}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900 leading-tight">
            {projectName}
          </h1>
          {version && (
            <p className="text-lg text-gray-600 mt-0.5">{version}</p>
          )}
          <p className="text-sm text-gray-500 mt-1">{groupName}</p>
        </div>

        {/* Center Column - Crew Call Badge (perfectly centered) */}
        <div className="flex flex-col items-center justify-self-center">
          <span className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
            Crew Call
          </span>
          <div className={`${getShapeClasses(centerShape)} flex flex-col items-center justify-center`}>
            <span className="text-3xl font-light text-gray-400 leading-none">
              {time}
            </span>
            <span className="text-lg font-normal text-gray-400">{period}</span>
          </div>
        </div>

        {/* Right Column - Date and Day */}
        <div className="text-right">
          <p className="text-lg font-medium text-gray-700">{date}</p>
          <p className="text-xl font-semibold text-gray-900">
            Day {dayNumber} of {totalDays}
          </p>
        </div>
      </div>
    </header>
  );
}

/**
 * Compact header for Page 2 - Abbreviated version for crew page
 */
export function CallSheetHeaderCompact({
  projectName,
  version,
  date,
  dayNumber,
  totalDays,
  crewCallTime,
  centerShape = "circle",
}: CallSheetHeaderCompactProps) {
  const { time, period } = formatCrewCall(crewCallTime);

  return (
    <header className="mb-6 pb-4 border-b border-gray-200">
      {/* Use CSS Grid for proper centering */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        {/* Left - Project Name */}
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 leading-tight truncate">
            {projectName}
          </h1>
          {version && (
            <p className="text-sm text-gray-600">{version}</p>
          )}
        </div>

        {/* Center - Smaller Crew Call Badge (perfectly centered) */}
        <div className="flex flex-col items-center justify-self-center">
          <span className="text-[9px] uppercase tracking-wider text-gray-400 mb-0.5">
            Crew Call
          </span>
          <div className={`${getCompactShapeClasses(centerShape)} flex flex-col items-center justify-center`}>
            <span className="text-xl font-light text-gray-400 leading-none">
              {time}
            </span>
            <span className="text-sm font-normal text-gray-400">{period}</span>
          </div>
        </div>

        {/* Right - Date and Day */}
        <div className="text-right">
          <p className="text-sm text-gray-600">{date}</p>
          <p className="text-lg font-semibold text-gray-900">
            Day {dayNumber} of {totalDays}
          </p>
        </div>
      </div>
    </header>
  );
}
