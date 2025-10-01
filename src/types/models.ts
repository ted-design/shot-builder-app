import type { Timestamp } from "firebase/firestore";

export type ShotStatus = "todo" | "in_progress" | "complete" | "on_hold";

export interface Project {
  id: string;
  name: string;
  briefUrl?: string | null;
  notes?: string | null;
  shootDates?: string[];
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
  deletedAt?: Timestamp | Date | null;
}

export interface ShotTalent {
  talentId: string;
  name: string;
}

export interface ShotProduct {
  productId: string;
  productName: string;
  styleNumber?: string | null;
  colourId?: string | null;
  colourName?: string | null;
  colourImagePath?: string | null;
  thumbnailImagePath?: string | null;
  size?: string | null;
  sizeScope?: "all" | "single" | "pending";
  status?: "pending-size" | "complete";
}

export interface Shot {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  notes?: string;
  date?: string | Timestamp | null;
  projectId: string;
  talent?: ShotTalent[];
  talentIds?: string[];
  locationId?: string | null;
  locationName?: string | null;
  productIds?: string[];
  products?: ShotProduct[];
  status?: ShotStatus;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface PlannerLane {
  id: string;
  title: string;
  shotIds: string[];
  sortOrder?: number;
  date?: string | Timestamp | null;
  talentId?: string | null;
}

export interface PullItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
  shotId?: string;
  productId?: string;
}

export interface Pull {
  id: string;
  projectId: string;
  shotIds: string[];
  items: PullItem[];
  name: string;
  status?: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;
}

export interface ShotsCardToggles {
  showProducts: boolean;
  showTalent: boolean;
  showLocation: boolean;
  showNotes: boolean;
}

export interface UserViewPrefs {
  shotsCardToggles?: Partial<ShotsCardToggles>;
  shotsSort?: "alpha" | "alpha_desc" | "byTalent" | "byDate";
}
