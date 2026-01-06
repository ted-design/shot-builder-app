import type { DayDetails } from "../../types/callsheet";

type ScheduleLike = {
  name?: string;
  date?: any;
};

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch {
      return null;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function buildCallSheetVariableContext(options: {
  schedule?: ScheduleLike | null;
  dayDetails?: DayDetails | null;
  projectTitle?: string | null;
  companyName?: string | null;
  totalDays?: number | null;
  dayNumber?: number | null;
}) {
  const { schedule, dayDetails, projectTitle, companyName, totalDays, dayNumber } = options;
  const dateObj = toDate(schedule?.date);
  const currentDate = dateObj
    ? dateObj.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  const resolvedProjectTitle = projectTitle || schedule?.name || "";
  const resolvedCompanyName = companyName || "";
  const dayXofY =
    typeof dayNumber === "number" && typeof totalDays === "number" && totalDays > 0
      ? `Day ${dayNumber} of ${totalDays}`
      : "";

  return {
    "@projectTitle": resolvedProjectTitle,
    "@companyName": resolvedCompanyName,
    "@currentDate": currentDate,
    "@dayXofY": dayXofY,
    "@generalCrewCall": dayDetails?.crewCallTime || "",
    "@shootingCall": dayDetails?.shootingCallTime || "",
    "@estWrap": dayDetails?.estimatedWrap || "",
  } as const;
}

export type CallSheetVariableKey = keyof ReturnType<typeof buildCallSheetVariableContext>;

export function resolveCallSheetVariable(
  variable: string,
  ctx: ReturnType<typeof buildCallSheetVariableContext>
) {
  if (!variable || typeof variable !== "string") return "";
  const key = variable as CallSheetVariableKey;
  return ctx[key] || "";
}

