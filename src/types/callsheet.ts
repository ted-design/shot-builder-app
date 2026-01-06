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
  | "custom-banner"
  | "quote";

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

export interface DayDetailsCustomLocation {
  id: string;
  title?: string | null;
  locationId?: string | null;
  label?: string | null;
  notes?: string | null;
}

export type DayDetailsNotesIcon = "note" | "info" | "alert" | null;

export interface DayDetailsNotesStyle {
  placement?: "top" | "bottom" | null;
  color?: string | null;
  icon?: DayDetailsNotesIcon;
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
  customLocations?: DayDetailsCustomLocation[] | null;
  weather?: WeatherData | null;
  keyPeople?: string | null;
  setMedic?: string | null;
  scriptVersion?: string | null;
  scheduleVersion?: string | null;
  notes?: string | null;
  notesStyle?: DayDetailsNotesStyle | null;
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
  role?: string | null;
  blockRhs?: string | null;
  muWard?: string | null;
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

export interface ClientCallSheet {
  id: string;
  name: string;
  role?: string | null;
  callTime?: string | null;
  callText?: string | null;
  setTime?: string | null;
  status?: "confirmed" | "pending" | "cancelled" | null;
  transportation?: string | null;
  blockRhs?: string | null;
  muWard?: string | null;
  notes?: string | null;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

// =============================================================================
// Call Sheet Layout V2 (SetHero-style modular builder)
// =============================================================================

export const CALL_SHEET_LAYOUT_V2_SCHEMA_VERSION = 2 as const;

export type CallSheetLayoutSchemaVersion = typeof CALL_SHEET_LAYOUT_V2_SCHEMA_VERSION;

export type CallSheetFieldWidth =
  | "hidden"
  | "x-small"
  | "small"
  | "medium"
  | "large"
  | "x-large";

export interface CallSheetTextStyle {
  fontSize?: number | null;
  color?: string | null;
  align?: "left" | "center" | "right" | null;
  lineHeight?: number | null;
  marginTop?: number | null;
  marginBottom?: number | null;
  marginLeft?: number | null;
  marginRight?: number | null;
  wrap?: "wrap" | "nowrap" | null;
}

export type CallSheetHeaderVariable =
  | "@projectTitle"
  | "@companyName"
  | "@currentDate"
  | "@dayXofY"
  | "@generalCrewCall"
  | "@shootingCall"
  | "@estWrap";

export interface CallSheetHeaderItem {
  type: "variable" | "text" | "image";
  value: string;
  style?: CallSheetTextStyle | null;
  enabled: boolean;
}

export interface CallSheetHeaderColumn {
  items: CallSheetHeaderItem[];
}

export type CallSheetHeaderPreset = "classic" | "center-logo" | "multiple-logos";

export type CallSheetCenterShape = "none" | "circle" | "rectangle";

export interface CallSheetHeaderConfigV2 {
  left: CallSheetHeaderColumn;
  center: CallSheetHeaderColumn;
  right: CallSheetHeaderColumn;
  preset: CallSheetHeaderPreset;
  centerShape?: CallSheetCenterShape;
}

export interface CallSheetFieldConfig {
  id: string;
  name: string;
  originalName: string;
  width: CallSheetFieldWidth;
  enabled: boolean;
  order: number;
}

export type CallSheetSectionConfig = Record<string, unknown>;

export interface CallSheetSectionV2 {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  config: CallSheetSectionConfig;
  fields: CallSheetFieldConfig[];
}

export interface CallSheetPageSizeV2 {
  width: number;
  height: number;
  unit: "inches" | "mm";
}

export interface CallSheetSettingsV2 {
  pageSize: CallSheetPageSizeV2;
  spacing: CallSheetSpacing;
  timeFormat: CallSheetTimeFormat;
  tempFormat: CallSheetTemperatureFormat;
  showFooterLogo: boolean;
  colors: CallSheetColors;
}

export interface CallSheetLayoutV2 {
  schemaVersion: CallSheetLayoutSchemaVersion;
  header: CallSheetHeaderConfigV2;
  sections: CallSheetSectionV2[];
  settings: CallSheetSettingsV2;
}

export interface CallSheetLayoutDocumentV2 {
  id: string;
  projectId: string;
  scheduleId: string;
  layout: CallSheetLayoutV2;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

export type CallSheetScheduleEntryTypeV2 = "setup" | "shot" | "banner" | "move";

export interface CallSheetScheduleEntryV2 {
  id: string;
  time: string;
  duration: number;
  type: CallSheetScheduleEntryTypeV2;
  title: string;
  description?: string;
  location?: string;
  note?: string;
  flag?: string;
  sceneId?: string;
  cast?: string[];
  products?: string[];
}
