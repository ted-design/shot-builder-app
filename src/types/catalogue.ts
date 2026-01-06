import type { Timestamp } from "firebase/firestore";

/**
 * PersonType distinguishes between Talent and Crew in the Catalogue.
 * - "talent": Models, actors, and on-camera talent
 * - "crew": Behind-the-scenes crew members (directors, camera ops, etc.)
 */
export type PersonType = "talent" | "crew";

/**
 * CataloguePerson is a unified type representing both Talent and Crew members.
 * This allows the Catalogue to display and filter both types in a single table.
 */
export interface CataloguePerson {
  id: string;
  type: PersonType;

  // Common fields
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;

  // Display name (computed)
  displayName: string;

  // Avatar/initials
  avatar: string;

  // Talent-specific fields
  agency?: string | null;
  gender?: string | null;
  url?: string | null;
  headshotPath?: string | null;
  measurements?: Record<string, unknown> | null;

  // Crew-specific fields
  positionId?: string | null;
  departmentId?: string | null;
  company?: string | null;

  // Role display (position name for crew, role name for talent)
  role?: string | null;

  // Location (derived from talent/crew data or "Not set")
  location?: string | null;

  // Pay rate (if available)
  payRate?: string | null;

  // Timestamps
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  createdBy?: string | null;
}

/**
 * CatalogueFilterGroup represents the filter state in the Catalogue sidebar.
 */
export type CatalogueFilterGroup = "all" | "crew" | "talent";

/**
 * CatalogueViewMode controls how talent is displayed (by person or by role).
 */
export type CatalogueViewMode = "person" | "role";

/**
 * CatalogueLocation represents a location in the Catalogue.
 */
export interface CatalogueLocation {
  id: string;
  name: string;
  address?: string | null;
  notes?: string | null;
  inProject: boolean;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

/**
 * CatalogueCounts tracks the count of each person type for the sidebar badges.
 */
export interface CatalogueCounts {
  all: number;
  crew: number;
  talent: number;
}
