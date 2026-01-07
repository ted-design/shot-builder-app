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
  time: string;
  duration: string;
  description: string;
  cast: string;
  notes: string;
  location: CallSheetScheduleLocation | null;
  isBanner?: boolean;
}

export interface CallSheetDayDetails {
  crewCallTime?: string | null;
  shootingCallTime?: string | null;
  breakfastTime?: string | null;
  firstMealTime?: string | null;
  secondMealTime?: string | null;
  estimatedWrap?: string | null;
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

export interface CallSheetData {
  projectName: string;
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
  pageBreakAfterHeader?: boolean;
  pageBreakAfterTalent?: boolean;
}

