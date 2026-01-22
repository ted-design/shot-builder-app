/**
 * WorkspaceContext - Shared state for the product workspace
 *
 * Provides:
 * - activeSection: Current section being viewed (overview, colorways, samples, etc.)
 * - selectedColorwayId: Currently selected colorway (persists across sections)
 *
 * This context ensures state continuity as users navigate between sections.
 */

import { createContext, useContext } from "react";

export const WorkspaceContext = createContext(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  }
  return ctx;
}

/**
 * Section definitions for workspace navigation
 */
export const WORKSPACE_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    iconName: "LayoutGrid",
    description: "Product summary",
  },
  {
    id: "colorways",
    label: "Colorways",
    iconName: "Palette",
    description: "Color variants",
    countKey: "colorways",
  },
  {
    id: "samples",
    label: "Samples",
    iconName: "Box",
    description: "Sample tracking",
    countKey: "samples",
  },
  {
    id: "assets",
    label: "Assets",
    iconName: "FileText",
    description: "Files & docs",
    countKey: "assets",
  },
  {
    id: "activity",
    label: "Activity",
    iconName: "Activity",
    description: "Timeline",
    countKey: "activity",
  },
];
