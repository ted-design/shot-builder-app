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

/** Visual marker for schedule entries (icon + color) */
export interface ScheduleEntryMarker {
  icon: string;
  color: string;
}

export interface CallSheetScheduleItem {
  id: string;
  time: string;
  duration: string;
  description: string;
  cast: string;
  notes: string;
  location: CallSheetScheduleLocation | null;
  isBanner?: boolean;
  /** Optional visual marker for quick identification */
  marker?: ScheduleEntryMarker | null;
  /** Track ID this entry belongs to (for multi-track schedules) */
  trackId?: string | null;
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
