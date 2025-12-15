// src/types/schedule.ts
// TypeScript definitions for the Call Sheet Builder schedule system

import type { Timestamp } from "firebase/firestore";

// =============================================================================
// Track Types
// =============================================================================

/**
 * Tracks can be normal lane tracks, or shared tracks that represent items applying
 * across multiple lane tracks (e.g., Setup / Lunch spanning Photo + Video).
 */
export type TrackScope = "lane" | "shared";

/**
 * A track represents a parallel work stream in the schedule (e.g., Photo, Video).
 * Shared-scope tracks are used for full-width banner items in the preview.
 */
export interface Track {
  id: string;
  name: string;
  color: string; // Hex color code (e.g., "#F59E0B")
  order: number; // Sort order for display
  scope?: TrackScope; // Defaults to "lane" for backwards compatibility
}

/**
 * Default track templates for new schedules.
 */
export const DEFAULT_TRACKS: Track[] = [
  { id: "shared", name: "Shared", color: "#64748B", order: 0, scope: "shared" },
  { id: "photo", name: "Photo", color: "#F59E0B", order: 1, scope: "lane" },
  { id: "video", name: "Video", color: "#8B5CF6", order: 2, scope: "lane" },
];

// =============================================================================
// Column Configuration Types
// =============================================================================

/**
 * Column width presets matching SetHero's sizing options.
 */
export type ColumnWidth = "xs" | "sm" | "md" | "lg" | "xl" | "hidden";

/**
 * Mapping of column width presets to actual pixel/percentage values.
 */
export const COLUMN_WIDTH_VALUES: Record<ColumnWidth, number> = {
  xs: 60,
  sm: 100,
  md: 140,
  lg: 200,
  xl: 300,
  hidden: 0,
};

/**
 * Configuration for a single column in the schedule view.
 */
export interface ColumnConfig {
  key: string; // Unique column identifier (e.g., "time", "talent", "products")
  label: string; // Display label (user-customizable)
  width: ColumnWidth; // Column width preset
  visible: boolean; // Whether column is visible
  order: number; // Sort order for display
}

/**
 * Default column configuration for new schedules.
 */
export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: "time", label: "Time", width: "md", visible: true, order: 0 },
  { key: "duration", label: "Duration", width: "sm", visible: true, order: 1 },
  { key: "shot", label: "Shot", width: "sm", visible: true, order: 2 },
  { key: "description", label: "Description", width: "xl", visible: true, order: 3 },
  { key: "talent", label: "Talent", width: "md", visible: true, order: 4 },
  { key: "products", label: "Products", width: "md", visible: true, order: 5 },
  { key: "location", label: "Location", width: "lg", visible: true, order: 6 },
  { key: "notes", label: "Notes", width: "lg", visible: false, order: 7 },
];

// =============================================================================
// Schedule Settings Types
// =============================================================================

/**
 * User-configurable settings for a schedule.
 */
export interface ScheduleSettings {
  /** Whether to show duration next to time (e.g., "9:00 AM (30m)") */
  showDurations: boolean;

  /** Whether to auto-adjust subsequent times when an entry is moved/resized */
  cascadeChanges: boolean;

  /** Default duration in minutes for new entries */
  defaultEntryDuration: number;

  /** Time the day starts (e.g., "06:00" for 6 AM) */
  dayStartTime: string;

  /** Time increment for snapping (in minutes, e.g., 5, 15, 30) */
  timeIncrement: number;
}

/**
 * Default settings for new schedules.
 */
export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  showDurations: true,
  cascadeChanges: true,
  defaultEntryDuration: 15,
  dayStartTime: "06:00",
  timeIncrement: 15,
};

// =============================================================================
// Schedule Types
// =============================================================================

/**
 * A schedule represents a single day's call sheet for a project.
 * It contains tracks, column configuration, settings, and entries (in a subcollection).
 */
export interface Schedule {
  id: string;
  projectId: string;
  date: Timestamp | Date | string;
  name: string; // e.g., "Day 1 - Studio Shoot"
  tracks: Track[];
  columnConfig: ColumnConfig[];
  settings: ScheduleSettings;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  createdBy?: string; // User ID
}

/**
 * Data required to create a new schedule (without auto-generated fields).
 */
export type ScheduleInput = Omit<Schedule, "id" | "createdAt" | "updatedAt">;

// =============================================================================
// Entry Types
// =============================================================================

/**
 * Entry types distinguish between shots from the library and custom items.
 */
export type EntryType = "shot" | "custom";

/**
 * Categories for custom entries (non-shot items like breaks, setup, etc.).
 */
export type CustomEntryCategory =
  | "setup" // Load-in, equipment setup
  | "break" // Short break
  | "lunch" // Meal break
  | "wrap" // End of day, wrap out
  | "travel" // Location move
  | "meeting" // Production meeting, safety briefing
  | "talent" // Talent-specific (hair/makeup, wardrobe)
  | "other"; // Custom/uncategorized

/**
 * Category labels for display.
 */
export const CUSTOM_ENTRY_CATEGORY_LABELS: Record<CustomEntryCategory, string> = {
  setup: "Setup",
  break: "Break",
  lunch: "Lunch",
  wrap: "Wrap",
  travel: "Travel",
  meeting: "Meeting",
  talent: "Talent Prep",
  other: "Other",
};

/**
 * Category colors for visual distinction.
 */
export const CUSTOM_ENTRY_CATEGORY_COLORS: Record<CustomEntryCategory, string> = {
  setup: "#64748B", // Slate
  break: "#94A3B8", // Light slate
  lunch: "#10B981", // Emerald
  wrap: "#6366F1", // Indigo
  travel: "#F97316", // Orange
  meeting: "#3B82F6", // Blue
  talent: "#EC4899", // Pink
  other: "#71717A", // Zinc
};

/**
 * Data for custom entries (non-shot items).
 */
export interface CustomEntryData {
  title: string;
  notes?: string;
  location?: string;
  talent?: string[]; // Array of talent names (not IDs)
  category: CustomEntryCategory;
}

/**
 * A schedule entry represents a single item on the schedule.
 * It can be either a reference to an existing shot or a custom item.
 */
export interface ScheduleEntry {
  id: string;

  /** Track this entry belongs to */
  trackId: string;

  /** Start time in HH:MM format (24-hour) */
  startTime: string;

  /** Duration in minutes */
  duration: number;

  /** Sort order for entries at the same time */
  order: number;

  /** Entry type: shot reference or custom item */
  type: EntryType;

  /** Shot document ID (if type='shot') */
  shotRef: string | null;

  /** Custom entry data (if type='custom') */
  customData: CustomEntryData | null;

  /** Optional location override for this entry */
  locationId?: string | null;

  /** Optional schedule-specific notes for this entry */
  notes?: string | null;

  /** Optional subset of tracks this custom item applies to */
  appliesToTrackIds?: string[] | null;

  /** Timestamps */
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

/**
 * Data required to create a new entry (without auto-generated fields).
 */
export type ScheduleEntryInput = Omit<ScheduleEntry, "id" | "createdAt" | "updatedAt">;

// =============================================================================
// Resolved Entry Types (with joined shot data)
// =============================================================================

/**
 * A resolved entry includes the full shot data when type='shot',
 * plus computed fields like end time and overlap detection.
 */
export interface ResolvedEntry extends ScheduleEntry {
  /** Computed end time (startTime + duration) in HH:MM format */
  endTime: string;

  /** Title from shot or custom data */
  resolvedTitle: string;

  /** Talent names */
  resolvedTalent: string[];

  /** Product names */
  resolvedProducts: string[];

  /** Location name */
  resolvedLocation: string;

  /** Primary image URL */
  resolvedImage: string | null;

  /** Notes/description */
  resolvedNotes: string;

  /** Whether this entry overlaps with another on a different track */
  hasOverlap: boolean;

  /** IDs of entries this overlaps with */
  overlapsWith: string[];
}

// =============================================================================
// View State Types
// =============================================================================

/**
 * Available view modes for the schedule.
 */
export type ScheduleViewMode = "vertical" | "list";

/**
 * Zoom levels for the timeline view.
 */
export type TimelineZoomLevel = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/**
 * View state for the schedule builder.
 */
export interface ScheduleViewState {
  /** Current view mode (vertical or list) */
  viewMode: ScheduleViewMode;

  /** Current zoom level for timeline */
  zoomLevel: TimelineZoomLevel;

  /** Visible tracks (null = all visible) */
  visibleTrackIds: string[] | null;

  /** Currently selected entry ID */
  selectedEntryId: string | null;

  /** Currently dragging entry ID */
  draggingEntryId: string | null;
}

/**
 * Default view state.
 */
export const DEFAULT_VIEW_STATE: ScheduleViewState = {
  viewMode: "vertical",
  zoomLevel: 1,
  visibleTrackIds: null,
  selectedEntryId: null,
  draggingEntryId: null,
};
