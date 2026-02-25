import React from "react";
import type { CallSheetHeaderItem, CallSheetTextStyle } from "../../../types/callsheet";
import type { CallSheetDayDetails } from "../types";
import { resolveCallSheetVariable } from "../../../lib/callsheet/variables";
import { sanitizeHtml, hasRichContent } from "../../../lib/sanitizeHtml";

type CenterShape = "none" | "circle" | "rectangle";

interface HeaderItemsLayout {
  left: CallSheetHeaderItem[];
  center: CallSheetHeaderItem[];
  right: CallSheetHeaderItem[];
}

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
  headerItems?: HeaderItemsLayout;
  variableContext?: Record<string, string>;
  dayDetails?: CallSheetDayDetails | null;
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
 * Format time from HH:MM to 12h display format with AM/PM.
 */
function formatTime12h(time: string | null | undefined): string {
  if (!time) return "";
  const [hRaw, mRaw] = time.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
}

/**
 * CallTimesBox - SetHero-style call times box for header right column.
 * Only renders rows that have values. Renders nothing if no rows have values.
 */
interface CallTimeRow {
  label: string;
  time: string;
}

function CallTimesBox({ dayDetails }: { dayDetails: CallSheetDayDetails | null | undefined }) {
  if (!dayDetails) return null;

  // Build array of call time rows - only include those with values
  const rows: CallTimeRow[] = [];

  if (dayDetails.crewCallTime) {
    rows.push({ label: "Crew Call", time: formatTime12h(dayDetails.crewCallTime) });
  }
  if (dayDetails.breakfastTime) {
    rows.push({ label: "Breakfast", time: formatTime12h(dayDetails.breakfastTime) });
  }
  if (dayDetails.shootingCallTime) {
    rows.push({ label: "Shooting Call", time: formatTime12h(dayDetails.shootingCallTime) });
  }
  if (dayDetails.firstMealTime) {
    rows.push({ label: "Lunch", time: formatTime12h(dayDetails.firstMealTime) });
  }
  if (dayDetails.secondMealTime) {
    rows.push({ label: "2nd Meal", time: formatTime12h(dayDetails.secondMealTime) });
  }
  if (dayDetails.estimatedWrap) {
    rows.push({ label: "Est. Wrap", time: formatTime12h(dayDetails.estimatedWrap) });
  }

  // If no rows have values, render nothing
  if (rows.length === 0) return null;

  return (
    <div className="mt-2">
      {/* 3-column grid: dot (fixed) | label (right-aligned) | time (left-aligned) */}
      <div className="grid grid-cols-[auto_auto_auto] gap-x-2 gap-y-0.5 justify-end text-xxs">
        {rows.map((row) => (
          <React.Fragment key={row.label}>
            <span className="w-1.5 h-1.5 rounded-full border border-gray-400 self-center" />
            <span className="text-gray-600 font-medium text-right">{row.label}</span>
            <span className="text-gray-800 font-medium tabular-nums text-left">{row.time}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
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
 * Build inline styles from CallSheetTextStyle
 */
function buildItemStyle(style?: CallSheetTextStyle | null): React.CSSProperties {
  if (!style) return {};
  const css: React.CSSProperties = {};
  if (style.fontSize != null) css.fontSize = `${style.fontSize}px`;
  if (style.color) css.color = style.color;
  if (style.align) css.textAlign = style.align;
  if (style.lineHeight != null) css.lineHeight = style.lineHeight;
  if (style.marginTop != null) css.marginTop = `${style.marginTop}px`;
  if (style.marginBottom != null) css.marginBottom = `${style.marginBottom}px`;
  if (style.marginLeft != null) css.marginLeft = `${style.marginLeft}px`;
  if (style.marginRight != null) css.marginRight = `${style.marginRight}px`;
  if (style.wrap === "nowrap") css.whiteSpace = "nowrap";
  else if (style.wrap === "wrap") css.whiteSpace = "normal";
  return css;
}

/**
 * Render a single header item (text, variable, or image)
 */
function renderHeaderItem(
  item: CallSheetHeaderItem,
  variableContext: Record<string, string>,
  index: number
) {
  if (!item.enabled) return null;

  const style = buildItemStyle(item.style);

  if (item.type === "variable") {
    // Deprecation: @companyName is hidden and should not render
    if (item.value === "@companyName") return null;

    // Resolve variable using context - fallback to raw variable token if not found
    const resolvedText = resolveCallSheetVariable(item.value, variableContext as Parameters<typeof resolveCallSheetVariable>[1]);
    return (
      <div key={`item-${index}`} style={style} className="leading-tight">
        {resolvedText || item.value}
      </div>
    );
  }

  if (item.type === "text") {
    // Check for rich text content first, fall back to plain value
    if (hasRichContent(item.richText)) {
      const sanitized = sanitizeHtml(item.richText!);
      return (
        <div
          key={`item-${index}`}
          style={style}
          className="leading-tight header-richtext"
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      );
    }
    return (
      <div key={`item-${index}`} style={style} className="leading-tight">
        {item.value}
      </div>
    );
  }

  if (item.type === "image") {
    // Image value is the URL/path
    return (
      <img
        key={`item-${index}`}
        src={item.value}
        alt=""
        style={{ ...style, maxHeight: style.fontSize ? undefined : "64px", objectFit: "contain" }}
        className="max-w-full"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }

  return null;
}

/**
 * Render a column of header items
 */
function renderHeaderColumn(
  items: CallSheetHeaderItem[],
  variableContext: Record<string, string>,
  align: "left" | "center" | "right"
) {
  const enabledItems = items.filter((item) => item.enabled);
  if (enabledItems.length === 0) return null;

  const alignClass = align === "left" ? "items-start text-left" : align === "right" ? "items-end text-right" : "items-center text-center";

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      {enabledItems.map((item, index) => renderHeaderItem(item, variableContext, index))}
    </div>
  );
}

/**
 * Full header for Page 1 - SetHero style with 3-column layout
 * When headerItems is provided with enabled items, renders the custom layout.
 * Otherwise, falls back to the hardcoded default layout.
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
  headerItems,
  variableContext,
  dayDetails,
}: CallSheetHeaderProps) {
  const { time, period } = formatCrewCall(crewCallTime);

  // Check if we have custom header items to render
  const hasCustomItems = headerItems && variableContext && (
    headerItems.left.some((item) => item.enabled) ||
    headerItems.center.some((item) => item.enabled) ||
    headerItems.right.some((item) => item.enabled)
  );

  // Render custom layout when headerItems are provided
  if (hasCustomItems && headerItems && variableContext) {
    return (
      <header className="mb-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          {/* Left Column - Custom Items */}
          <div className="min-w-0">
            {renderHeaderColumn(headerItems.left, variableContext, "left")}
          </div>

          {/* Center Column - Custom Items + Crew Call Badge */}
          <div className="flex flex-col items-center justify-self-center">
            {renderHeaderColumn(headerItems.center, variableContext, "center")}
            {/* Crew Call Badge - always rendered in center */}
            <div className="flex flex-col items-center mt-2">
              <span className="text-2xs uppercase tracking-wider text-gray-400 mb-1">
                Crew Call
              </span>
              <div className={`${getShapeClasses(centerShape)} flex flex-col items-center justify-center`}>
                <span className="text-3xl font-light text-gray-400 leading-none">
                  {time}
                </span>
                <span className="text-lg font-normal text-gray-400">{period}</span>
              </div>
            </div>
          </div>

          {/* Right Column - Custom Items + Call Times */}
          <div className="min-w-0">
            {renderHeaderColumn(headerItems.right, variableContext, "right")}
            <CallTimesBox dayDetails={dayDetails} />
          </div>
        </div>
      </header>
    );
  }

  // Fallback: Render hardcoded default layout
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
          <span className="text-2xs uppercase tracking-wider text-gray-400 mb-1">
            Crew Call
          </span>
          <div className={`${getShapeClasses(centerShape)} flex flex-col items-center justify-center`}>
            <span className="text-3xl font-light text-gray-400 leading-none">
              {time}
            </span>
            <span className="text-lg font-normal text-gray-400">{period}</span>
          </div>
        </div>

        {/* Right Column - Date, Day, and Call Times */}
        <div className="text-right">
          <p className="text-lg font-medium text-gray-700">{date}</p>
          <p className="text-xl font-semibold text-gray-900">
            Day {dayNumber} of {totalDays}
          </p>
          <CallTimesBox dayDetails={dayDetails} />
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
          <span className="text-3xs uppercase tracking-wider text-gray-400 mb-0.5">
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
