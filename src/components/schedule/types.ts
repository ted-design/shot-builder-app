import type { EntryMarker } from "../../types/schedule";

export interface CallSheetColors {
  primary: string;
  primaryText: string;
  accent: string;
  rowAlternate: string;
}

export interface CallSheetLocation {
  type: string;
  name: string;
  address: string;
  notes?: string;
}

export interface CallSheetScheduleLocation {
  name: string;
  address: string;
}

export interface CallSheetScheduleItem {
  id: string;
  /** Display-formatted time (e.g., "7:00 AM") */
  time: string;
  /** Display-formatted duration (e.g., "30m") */
  duration: string;
  description: string;
  cast: string;
  notes: string;
  location: CallSheetScheduleLocation | null;
  isBanner?: boolean;
  /** Optional visual marker for quick identification */
  marker?: EntryMarker | null;
  /** Track ID this entry belongs to (for multi-track schedules) */
  trackId?: string | null;
  /** Canonical start time in HH:MM format (e.g., "07:00") for conflict detection */
  startTimeCanonical?: string | null;
  /** Canonical duration in minutes (e.g., 30) for conflict detection */
  durationMinutes?: number | null;
  /** Optional subset of track IDs this entry applies to (for shared/banner entries) */
  appliesToTrackIds?: string[] | null;
  /** Applicability classification from projection ("all" | "subset" | "single" | "none") */
  applicabilityKind?: "all" | "subset" | "single" | "none";
  /** Pre-computed conflict status from projection */
  hasConflict?: boolean;
  /** Start time in minutes from midnight (from projection) */
  startMin?: number | null;
  /** How time was determined: "explicit" (user-set), "derived" (computed), or "none" */
  timeSource?: "explicit" | "derived" | "none";
  /** Original entry order (for debugging/reference) */
  order?: number;
  /** Optional color tag key for visual grouping (SetHero-style) */
  colorKey?: string | null;
}

export interface CallSheetDayDetails {
  crewCallTime?: string | null;
  shootingCallTime?: string | null;
  breakfastTime?: string | null;
  firstMealTime?: string | null;
  secondMealTime?: string | null;
  estimatedWrap?: string | null;
  keyPeople?: string | null;
  setMedic?: string | null;
  scriptVersion?: string | null;
  scheduleVersion?: string | null;
  weather?: {
    lowTemp?: number | null;
    highTemp?: number | null;
    sunrise?: string | null;
    sunset?: string | null;
    summary?: string | null;
  } | null;
  notes?: string | null;
}

export interface CallSheetTalentRow {
  id: string;
  name: string;
  role?: string;
  callTime?: string | null;
  status?: string;
  notes?: string;
}

export interface CallSheetCrewRow {
  id: string;
  department?: string;
  role?: string;
  name: string;
  callTime?: string | null;
  notes?: string;
}

/** Track reference for schedule display */
export interface CallSheetTrack {
  id: string;
  name: string;
}

export interface CallSheetData {
  projectName: string;
  /** Real project title (e.g., "UM • Q4-2025"). Falls back to projectName if not provided. */
  projectTitle?: string;
  version: string;
  groupName: string;
  shootDay: string;
  date: string;
  dayNumber: number;
  totalDays: number;
  crewCallTime: string | null;
  dayDetails: CallSheetDayDetails;
  locations: CallSheetLocation[];
  notes?: string;
  schedule: CallSheetScheduleItem[];
  talent: CallSheetTalentRow[];
  crew: CallSheetCrewRow[];
  /** Tracks for multi-track schedule display (optional for backward compatibility) */
  tracks?: CallSheetTrack[];
  pageBreakAfterHeader?: boolean;
  pageBreakAfterTalent?: boolean;
}
