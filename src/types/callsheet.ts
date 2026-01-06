import type { Timestamp } from "firebase/firestore";

export type HeaderLayout = "classic" | "center-logo" | "multiple-logos";

export interface CallSheetColors {
  primary: string;
  accent: string;
  text: string;
  background?: string;
}

export type HeaderElement =
  | {
      id: string;
      type: "text";
      value: string;
      align?: "left" | "center" | "right";
      size?: "sm" | "md" | "lg";
    }
  | {
      id: string;
      type: "image";
      src: string;
      alt?: string;
      align?: "left" | "center" | "right";
      heightPx?: number;
    };

export type SectionType =
  | "header"
  | "day-details"
  | "reminders"
  | "schedule"
  | "clients"
  | "talent"
  | "extras"
  | "advanced-schedule"
  | "page-break"
  | "crew"
  | "notes-contacts"
  | "custom-banner";

export interface CallSheetSection<TConfig = Record<string, unknown>> {
  id: string;
  type: SectionType;
  isVisible: boolean;
  order: number;
  config: TConfig;
}

export type CallSheetPageSize = "auto" | "letter" | "a4";
export type CallSheetSpacing = "compact" | "normal" | "relaxed";
export type CallSheetTimeFormat = "12h" | "24h";
export type CallSheetTemperatureFormat = "celsius" | "fahrenheit";

export interface CallSheetConfig {
  id: string;
  projectId: string;
  scheduleId: string;
  headerLayout: HeaderLayout;
  headerElements: HeaderElement[];
  sections: CallSheetSection[];
  pageSize: CallSheetPageSize;
  spacing: CallSheetSpacing;
  timeFormat: CallSheetTimeFormat;
  temperatureFormat: CallSheetTemperatureFormat;
  showFooterLogo: boolean;
  colors: CallSheetColors;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface LocationReference {
  locationId?: string | null;
  label?: string | null;
  notes?: string | null;
}

export interface WeatherData {
  lowTemp?: number | null;
  highTemp?: number | null;
  sunrise?: string | null;
  sunset?: string | null;
  summary?: string | null;
}

export interface DayDetails {
  scheduleId: string;
  crewCallTime: string;
  shootingCallTime: string;
  breakfastTime?: string | null;
  firstMealTime?: string | null;
  secondMealTime?: string | null;
  estimatedWrap: string;
  productionOffice?: LocationReference | null;
  nearestHospital?: LocationReference | null;
  parking?: LocationReference | null;
  basecamp?: LocationReference | null;
  weather?: WeatherData | null;
  keyPeople?: string | null;
  setMedic?: string | null;
  scriptVersion?: string | null;
  scheduleVersion?: string | null;
  notes?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface TalentCallSheet {
  talentId: string;
  callTime?: string | null;
  callText?: string | null;
  setTime?: string | null;
  wrapTime?: string | null;
  status?: "confirmed" | "pending" | "cancelled" | null;
  transportation?: string | null;
  notes?: string | null;
  colorCode?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export interface CrewCallSheet {
  crewMemberId: string;
  callTime?: string | null;
  callText?: string | null;
  wrapTime?: string | null;
  wrapText?: string | null;
  notes?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}
