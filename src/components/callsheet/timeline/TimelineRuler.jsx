// src/components/callsheet/timeline/TimelineRuler.jsx
// Time scale ruler for the timeline view

import React, { useMemo } from "react";
import { generateTimeSlots, parseTimeToMinutes } from "../../../lib/timeUtils";

// Base width per hour in pixels (at zoom level 1)
const BASE_HOUR_WIDTH = 120;

/**
 * TimelineRuler - Horizontal time scale ruler
 *
 * @param {object} props
 * @param {string} props.dayStart - Day start time (HH:MM)
 * @param {string} props.dayEnd - Day end time (HH:MM)
 * @param {number} props.zoomLevel - Current zoom level
 * @param {number} props.trackLabelWidth - Width of track label column
 */
function TimelineRuler({
  dayStart = "06:00",
  dayEnd = "22:00",
  zoomLevel = 1,
  trackLabelWidth = 120,
}) {
  // Calculate hour width based on zoom
  const hourWidth = BASE_HOUR_WIDTH * zoomLevel;

  // Generate time slots for the ruler
  const timeSlots = useMemo(() => {
    // Use 1-hour intervals for main labels
    return generateTimeSlots(dayStart, dayEnd, 60);
  }, [dayStart, dayEnd]);

  // Calculate total width
  const dayStartMinutes = parseTimeToMinutes(dayStart);
  const dayEndMinutes = parseTimeToMinutes(dayEnd);
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const totalWidth = (totalMinutes / 60) * hourWidth;

  // Generate minor tick marks (every 15 or 30 min depending on zoom)
  const minorTicks = useMemo(() => {
    const interval = zoomLevel >= 1.25 ? 15 : 30;
    const ticks = [];
    for (let m = dayStartMinutes; m < dayEndMinutes; m += interval) {
      // Skip major ticks (on the hour)
      if (m % 60 !== 0) {
        const position = ((m - dayStartMinutes) / totalMinutes) * 100;
        ticks.push({ minutes: m, position });
      }
    }
    return ticks;
  }, [dayStartMinutes, dayEndMinutes, totalMinutes, zoomLevel]);

  return (
    <div className="relative flex border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
      {/* Track label spacer - sticky to stay aligned with track labels on horizontal scroll */}
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900"
        style={{ width: trackLabelWidth }}
      />

      {/* Ruler area */}
      <div
        className="relative h-8 overflow-hidden"
        style={{ width: totalWidth }}
      >
        {/* Minor tick marks */}
        {minorTicks.map((tick) => (
          <div
            key={tick.minutes}
            className="absolute top-4 h-2 w-px bg-slate-200 dark:bg-slate-700"
            style={{ left: `${tick.position}%` }}
          />
        ))}

        {/* Major tick marks with labels */}
        {timeSlots.map((slot, index) => {
          const position =
            ((slot.minutes - dayStartMinutes) / totalMinutes) * 100;
          const isFirstOrLast = index === 0 || index === timeSlots.length - 1;

          return (
            <div
              key={slot.time}
              className="absolute top-0 flex h-full flex-col items-center"
              style={{
                left: `${position}%`,
                transform: "translateX(-50%)",
              }}
            >
              {/* Time label */}
              <span
                className={`text-[10px] font-medium leading-none ${
                  isFirstOrLast
                    ? "text-slate-600 dark:text-slate-400"
                    : "text-slate-500 dark:text-slate-500"
                }`}
              >
                {slot.label}
              </span>

              {/* Tick mark */}
              <div className="mt-auto h-3 w-px bg-slate-300 dark:bg-slate-600" />
            </div>
          );
        })}

        {/* Current time indicator */}
        <CurrentTimeIndicator
          dayStart={dayStart}
          dayEnd={dayEnd}
          totalMinutes={totalMinutes}
          dayStartMinutes={dayStartMinutes}
        />
      </div>
    </div>
  );
}

/**
 * Current time indicator line
 */
function CurrentTimeIndicator({ dayStart, dayEnd, totalMinutes, dayStartMinutes }) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Check if current time is within day bounds
  const dayEndMinutes = parseTimeToMinutes(dayEnd);
  if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) {
    return null;
  }

  const position = ((currentMinutes - dayStartMinutes) / totalMinutes) * 100;

  return (
    <div
      className="absolute top-0 h-full w-0.5 bg-red-500 dark:bg-red-400"
      style={{ left: `${position}%` }}
    >
      {/* Triangle indicator at top */}
      <div className="absolute -left-1 -top-0.5 h-0 w-0 border-x-4 border-t-4 border-x-transparent border-t-red-500 dark:border-t-red-400" />
    </div>
  );
}

export default TimelineRuler;

// Export constants for use in other components
export { BASE_HOUR_WIDTH };
