import type { Timestamp } from "firebase/firestore";

export type ShotStatus = "todo" | "in_progress" | "complete" | "on_hold";

export interface Project {
  id: string;
  name: string;
  briefUrl?: string | null;
  notes?: string | null;
  shootDates?: string[];
  status?: "active" | "archived" | "completed";
  archivedAt?: Timestamp | Date | null;
  archivedBy?: string | null;
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

export interface ImageCropPosition {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
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
  referenceImageCrop?: ImageCropPosition | null;
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

export interface PullItemSize {
  size: string;
  quantity: number;
  fulfilled: number;
  status: "pending" | "fulfilled" | "partial" | "substituted";
}

export interface PullItemChangeOrder {
  id: string;
  requestedBy: string;
  requestedAt: Timestamp | Date;
  reason: string;
  status: "pending" | "approved" | "rejected";
  substitution: {
    familyId: string;
    familyName: string;
    colourId?: string | null;
    colourName?: string | null;
    sizes: { size: string; quantity: number }[];
  };
  approvedBy?: string | null;
  approvedAt?: Timestamp | Date | null;
  rejectionReason?: string | null;
}

export interface PullItem {
  id: string;

  // Product identification
  familyId: string;
  familyName: string;
  styleNumber?: string | null;
  colourId?: string | null;
  colourName?: string | null;
  colourImagePath?: string | null;

  // Size and quantity details
  sizes: PullItemSize[];

  // Metadata
  notes?: string;
  gender?: string | null;
  category?: string | null;
  genderOverride?: string | null;
  categoryOverride?: string | null;

  // Fulfillment tracking
  fulfillmentStatus: "pending" | "fulfilled" | "partial" | "substituted";
  fulfilledBy?: string | null;
  fulfilledAt?: Timestamp | Date | null;

  // Change orders
  changeOrders?: PullItemChangeOrder[];

  // Legacy compatibility
  name?: string;
  quantity?: number;
  shotId?: string;
  productId?: string;

  // Shot references for aggregated items
  shotIds?: string[];
}

export interface Pull {
  id: string;
  projectId: string;
  shotIds: string[];
  items: PullItem[];
  name: string;
  title?: string;
  status?: string;
  createdAt?: Timestamp | Date | null;
  updatedAt?: Timestamp | Date | null;

  // Sorting
  sortOrder?: "product" | "gender" | "category" | "size" | "manual";

  // Export settings
  exportSettings?: {
    pdfOrientation?: "portrait" | "landscape";
    headerText?: string;
    subheaderText?: string;
    includeImages?: boolean;
    pageBreakStrategy?: "auto" | "by-category" | "by-gender";
  };

  // Sharing
  shareToken?: string | null;
  shareEnabled?: boolean;
  shareExpiresAt?: Timestamp | Date | null;

  // Statistics
  stats?: {
    totalItems: number;
    totalQuantity: number;
    byGender?: { [key: string]: number };
    byCategory?: { [key: string]: number };
  };
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
