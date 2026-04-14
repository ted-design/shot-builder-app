/**
 * Shared marker icon mapping for DayStream and CallSheet components.
 * Consolidates the icon component mapping used across:
 * - DayStreamBanner
 * - DayStreamBlock
 * - ScheduleBlockSection
 * - MarkerPicker
 */
import {
  Star,
  AlertTriangle,
  Clock,
  Camera,
  User,
  Zap,
  Heart,
  Flag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Maps marker icon keys to their Lucide icon components.
 * Must stay in sync with MARKER_ICONS in src/types/schedule.ts
 */
export const MARKER_ICON_MAP: Record<string, LucideIcon> = {
  star: Star,
  alert: AlertTriangle,
  clock: Clock,
  camera: Camera,
  user: User,
  zap: Zap,
  heart: Heart,
  flag: Flag,
};

/**
 * Get the icon component for a marker icon key.
 * Returns null if the key is not found.
 */
export function getMarkerIconComponent(iconKey: string | null | undefined): LucideIcon | null {
  if (!iconKey) return null;
  return MARKER_ICON_MAP[iconKey] ?? null;
}
