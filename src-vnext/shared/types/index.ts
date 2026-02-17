import type { Timestamp } from "firebase/firestore"

export type Role = "admin" | "producer" | "crew" | "warehouse" | "viewer"

export type ProjectStatus = "active" | "completed" | "archived"

export interface Project {
  readonly id: string
  readonly name: string
  readonly clientId: string
  readonly status: ProjectStatus
  /**
   * Legacy-compatible shoot dates (YYYY-MM-DD).
   * Stored as date-only strings to avoid timezone shifts.
   */
  readonly shootDates: string[]
  readonly notes?: string
  readonly briefUrl?: string
  /** Soft-delete marker (legacy). */
  readonly deletedAt?: unknown
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

export type ShotFirestoreStatus = "todo" | "in_progress" | "complete" | "on_hold"

export type SizeScope = "all" | "single" | "pending"

export interface ProductAssignment {
  readonly familyId: string
  readonly familyName?: string
  readonly skuId?: string
  readonly skuName?: string
  readonly colourId?: string
  readonly colourName?: string
  readonly size?: string
  readonly sizeScope?: SizeScope
  readonly quantity?: number
  /** Denormalized at write-time: skuImageUrl ?? familyImageUrl ?? undefined */
  readonly thumbUrl?: string
  readonly skuImageUrl?: string
  readonly familyImageUrl?: string
}

export type ShotTagCategory = "priority" | "gender" | "media" | "other"

export interface ShotTag {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly category?: ShotTagCategory
}

export interface ColorSwatch {
  /** Firestore document id (legacy convention: equals `colorKey`). */
  readonly id: string
  readonly name: string
  readonly colorKey?: string
  readonly normalizedName?: string
  readonly hexColor?: string | null
  readonly aliases?: ReadonlyArray<string>
  readonly swatchImagePath?: string | null
  /** Firestore Timestamp or epoch ms (legacy compatibility). */
  readonly createdAt?: unknown
  /** Firestore Timestamp or epoch ms (legacy compatibility). */
  readonly updatedAt?: unknown
}

export interface ShotReferenceImage {
  readonly id: string
  /** Firebase Storage path or a resolved URL (legacy compatibility). */
  readonly path: string
  /** Firebase Storage download URL (legacy compatibility). May equal `path`. */
  readonly downloadURL?: string
  /** Epoch ms or Firestore Timestamp (legacy compatibility). */
  readonly uploadedAt?: unknown
  readonly uploadedBy?: string
  /** Optional crop payload (legacy). */
  readonly cropData?: unknown
}

export interface ShotLook {
  readonly id: string
  readonly label?: string
  readonly order?: number
  readonly products: ProductAssignment[]
  /** References `productId`/`familyId` (legacy: productId). */
  readonly heroProductId?: string | null
  readonly references?: ReadonlyArray<ShotReferenceImage>
  /** References `references[].id`. */
  readonly displayImageId?: string | null
}

export type ShotReferenceLinkType = "web" | "video" | "document"

export interface ShotReferenceLink {
  readonly id: string
  readonly title: string
  readonly url: string
  readonly type: ShotReferenceLinkType
}

export interface Shot {
  readonly id: string
  readonly title: string
  readonly description?: string
  readonly projectId: string
  readonly clientId: string
  readonly status: ShotFirestoreStatus
  readonly talent: string[]
  readonly talentIds?: string[]
  readonly products: ProductAssignment[]
  readonly locationId?: string
  readonly locationName?: string
  readonly laneId?: string
  readonly sortOrder: number
  readonly shotNumber?: string
  readonly notes?: string
  readonly notesAddendum?: string
  readonly date?: Timestamp
  readonly heroImage?: { readonly path: string; readonly downloadURL: string }
  readonly looks?: ReadonlyArray<ShotLook>
  /** Which look is currently active (used for cover derivation). */
  readonly activeLookId?: string | null
  readonly tags?: ReadonlyArray<ShotTag>
  readonly referenceLinks?: ReadonlyArray<ShotReferenceLink>
  readonly deleted?: boolean
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
  readonly createdBy: string
}

// --- Public sharing (Shots) ---

export interface ShotShare {
  /** Doc id = share token. */
  readonly id: string
  readonly clientId: string
  readonly projectId: string
  /** Null/undefined means "share all project shots". */
  readonly shotIds?: readonly string[] | null
  readonly title?: string | null
  readonly enabled: boolean
  readonly expiresAt?: Timestamp | null
  readonly createdAt?: Timestamp
  readonly createdBy?: string
}

export interface ShotComment {
  readonly id: string
  readonly body: string
  readonly createdAt?: Timestamp
  readonly createdBy?: string
  readonly createdByName?: string | null
  readonly createdByAvatar?: string | null
  readonly deleted?: boolean
}

export type ShotVersionChangeType = "create" | "update" | "rollback"

export interface ShotVersion {
  readonly id: string
  readonly snapshot: Record<string, unknown>
  readonly createdAt?: Timestamp
  readonly createdBy?: string
  readonly createdByName?: string | null
  readonly createdByAvatar?: string | null
  readonly changeType?: ShotVersionChangeType
  readonly changedFields?: ReadonlyArray<string>
}

export type PullFirestoreStatus = "draft" | "published" | "in-progress" | "fulfilled"

export type FulfillmentFirestoreStatus =
  | "pending"
  | "fulfilled"
  | "partial"
  | "substituted"

export type PullItemSizeStatus = "pending" | "fulfilled" | "partial" | "substituted"

export interface PullItemSize {
  readonly size: string
  readonly quantity: number
  /** Number fulfilled (legacy + public responder compatibility) */
  readonly fulfilled: number
  readonly status?: PullItemSizeStatus
}

export type ChangeOrder = Record<string, unknown>

export interface PullItem {
  /** Stable id required for public fulfillment updates */
  readonly id?: string
  readonly familyId: string
  readonly familyName?: string
  readonly styleNumber?: string | null
  readonly gender?: string | null
  readonly colourId?: string | null
  readonly colourName?: string | null
  readonly sizes: PullItemSize[]
  readonly fulfillmentStatus: FulfillmentFirestoreStatus
  readonly notes?: string | null
  readonly changeOrders?: ChangeOrder[]
}

export interface Pull {
  readonly id: string
  readonly projectId: string
  readonly clientId: string
  readonly name?: string
  readonly title?: string
  readonly shotIds: string[]
  readonly items: PullItem[]
  readonly status: PullFirestoreStatus
  readonly shareToken?: string
  readonly shareEnabled: boolean
  readonly shareAllowResponses?: boolean
  /** Legacy field name used by callable + public view. */
  readonly shareExpireAt?: Timestamp | null
  /** Older/alternate field name. Prefer `shareExpireAt` if present. */
  readonly shareExpiresAt?: Timestamp | null
  readonly exportSettings?: Record<string, unknown>
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

export interface ProductFamily {
  readonly id: string
  readonly styleName: string
  readonly styleNumber?: string
  readonly previousStyleNumber?: string
  readonly gender?: string | null
  readonly productType?: string
  readonly productSubcategory?: string
  /** Legacy/derived label used in some list UIs. Prefer `productSubcategory`/`productType` going forward. */
  readonly category?: string
  /** Firebase Storage path for header image (legacy field: headerImagePath) */
  readonly headerImagePath?: string
  /** Firebase Storage path for thumbnail image (legacy field: thumbnailImagePath) */
  readonly thumbnailImagePath?: string
  /** Product lifecycle status (legacy string values; vNext treats as opaque). */
  readonly status?: string
  readonly archived?: boolean
  /** Legacy notes may be a string or a structured array. */
  readonly notes?: unknown
  readonly sizes?: ReadonlyArray<string>

  // Denormalized aggregates (computed by legacy writers)
  readonly skuCount?: number
  readonly activeSkuCount?: number
  readonly skuCodes?: ReadonlyArray<string>
  readonly colorNames?: ReadonlyArray<string>
  readonly sizeOptions?: ReadonlyArray<string>
  readonly shotIds?: ReadonlyArray<string>

  // Soft-delete (legacy)
  readonly deleted?: boolean
  readonly deletedAt?: Timestamp

  // Audit (legacy)
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string
  readonly updatedBy?: string
  readonly clientId: string
}

export interface ProductSku {
  readonly id: string
  readonly name: string
  readonly colorName?: string
  readonly skuCode?: string
  readonly sizes?: ReadonlyArray<string>
  readonly status?: string
  readonly archived?: boolean
  readonly imagePath?: string
  readonly colorKey?: string
  /** Legacy alias for `hexColor`. Prefer `hexColor`. */
  readonly colourHex?: string
  readonly hexColor?: string
  readonly deleted?: boolean
  readonly deletedAt?: Timestamp
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string
  readonly updatedBy?: string
}

export interface ProductClassification {
  readonly id: string
  readonly gender: string
  readonly typeKey: string
  readonly typeLabel: string
  readonly subcategoryKey?: string | null
  readonly subcategoryLabel?: string | null
  readonly archived?: boolean
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string | null
  readonly updatedBy?: string | null
}

// --- Product Workspace (Samples, Comments, Documents) ---

export type ProductSampleType = "shoot" | "pre_production" | "bulk"
export type ProductSampleStatus = "requested" | "in_transit" | "arrived" | "returned" | "issue"

export interface ProductSample {
  readonly id: string
  readonly type: ProductSampleType
  readonly status: ProductSampleStatus
  readonly sizeRun: ReadonlyArray<string>
  readonly carrier?: string | null
  readonly tracking?: string | null
  readonly eta?: Timestamp | null
  readonly arrivedAt?: Timestamp | null
  readonly notes?: string | null
  /** Optional: scope sample to a specific colorway SKU id. */
  readonly scopeSkuId?: string | null
  readonly deleted?: boolean
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string | null
  readonly updatedBy?: string | null
}

export interface ProductComment {
  readonly id: string
  readonly body: string
  readonly createdAt?: Timestamp
  readonly createdBy?: string
  readonly createdByName?: string | null
  readonly createdByAvatar?: string | null
  readonly deleted?: boolean
}

export interface ProductDocument {
  readonly id: string
  readonly name: string
  readonly storagePath: string
  readonly contentType?: string | null
  readonly sizeBytes?: number | null
  readonly createdAt?: Timestamp
  readonly createdBy?: string
  readonly createdByName?: string | null
  readonly createdByAvatar?: string | null
  readonly deleted?: boolean
}

export interface TalentRecord {
  readonly id: string
  readonly name: string
  readonly firstName?: string | null
  readonly lastName?: string | null
  /** Legacy: may be a Storage path (preferred) or a URL. */
  readonly imageUrl?: string
  /** Legacy field used by older talent surfaces. Prefer `imageUrl` going forward. */
  readonly headshotPath?: string | null
  /** Optional denormalized download URL (legacy). */
  readonly headshotUrl?: string | null
  readonly agency?: string
  readonly email?: string | null
  readonly phone?: string | null
  readonly url?: string | null
  readonly gender?: string | null
  readonly measurements?: Record<string, number | string | null | undefined> | null
  readonly notes?: string
  readonly galleryImages?: ReadonlyArray<{
    readonly id: string
    readonly path: string
    readonly downloadURL?: string | null
    readonly description?: string | null
    readonly order?: number
    readonly cropData?: unknown
  }>
  readonly castingSessions?: ReadonlyArray<{
    readonly id: string
    /** ISO date string (YYYY-MM-DD). */
    readonly date: string
    readonly title?: string | null
    /** Optional: link the session to a project for later export/reference. */
    readonly projectId?: string | null
    readonly location?: string | null
    /** Role / brief / notes about the ask for this session. */
    readonly brief?: string | null
    /** Casting decision outcome (free-form string stored from a controlled UI list). */
    readonly decision?: string | null
    /** Optional rating (1–5). */
    readonly rating?: number | null
    readonly notes?: string | null
    readonly images: ReadonlyArray<{
      readonly id: string
      readonly path: string
      readonly downloadURL?: string | null
      readonly description?: string | null
      readonly order?: number
      readonly cropData?: unknown
    }>
  }>
  /** Project membership (legacy project-scoped assets). */
  readonly projectIds?: readonly string[]
}

export interface LocationRecord {
  readonly id: string
  readonly name: string
  readonly address?: string
  readonly notes?: string
  /** Project membership (legacy project-scoped assets). */
  readonly projectIds?: readonly string[]
}

export interface AuthUser {
  readonly uid: string
  readonly email: string | null
  readonly displayName: string | null
  readonly photoURL: string | null
}

export interface AuthClaims {
  readonly role: Role
  readonly clientId: string
}

// --- Crew (org library, read-only in Slice 3) ---

export interface CrewRecord {
  readonly id: string
  readonly name: string
  readonly department?: string
  readonly position?: string
  readonly email?: string
  readonly phone?: string
  readonly notes?: string
  /** Project membership (legacy project-scoped assets). */
  readonly projectIds?: readonly string[]
}

// --- Schedules (Slice 3: Call Sheet Assembly) ---

export interface ScheduleTrack {
  readonly id: string
  readonly name: string
  readonly order: number
}

export interface ScheduleSettings {
  readonly cascadeChanges: boolean
  /** Canonical day start time (stored as 24h HH:MM). Display is 12h in UI. */
  readonly dayStartTime: string
  /** Default duration used when an entry has no duration set. */
  readonly defaultEntryDurationMinutes: number
}

export interface Schedule {
  readonly id: string
  readonly projectId: string
  readonly name: string
  readonly date: Timestamp | null
  readonly participatingTalentIds?: readonly string[]
  readonly tracks?: readonly ScheduleTrack[]
  readonly settings?: ScheduleSettings
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
  readonly createdBy?: string
}

export type ScheduleEntryType = "shot" | "setup" | "break" | "move" | "banner"

export type ScheduleEntryHighlightVariant = "solid" | "outline"

export interface ScheduleEntryHighlight {
  readonly variant: ScheduleEntryHighlightVariant
  readonly color: string
  readonly emoji?: string | null
}

export interface ScheduleEntry {
  readonly id: string
  readonly type: ScheduleEntryType
  readonly title: string
  readonly shotId?: string
  /** Canonical time (24h HH:MM). Prefer this over legacy `time`. */
  readonly startTime?: string | null
  /** Legacy/compat display field (may be 12h or 24h). Prefer `startTime` for logic. */
  readonly time?: string
  readonly duration?: number
  readonly order: number
  readonly trackId?: string
  /** Shared/subset applicability (multi-stream). Null/undefined means track-local. */
  readonly appliesToTrackIds?: readonly string[] | null
  readonly highlight?: ScheduleEntryHighlight | null
  readonly notes?: string
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
}

export interface LocationBlock {
  readonly id: string
  readonly title: string
  readonly ref: {
    readonly locationId?: string | null
    readonly label?: string | null
    readonly notes?: string | null
  } | null
  readonly showName: boolean
  readonly showPhone: boolean
}

export interface WeatherData {
  readonly lowTemp?: number | null
  readonly highTemp?: number | null
  readonly sunrise?: string | null
  readonly sunset?: string | null
  readonly summary?: string | null
}

export interface DayDetails {
  readonly id: string
  readonly scheduleId: string
  readonly crewCallTime: string
  readonly shootingCallTime: string
  readonly breakfastTime?: string | null
  readonly firstMealTime?: string | null
  readonly secondMealTime?: string | null
  readonly estimatedWrap: string
  readonly locations?: readonly LocationBlock[] | null
  readonly weather?: WeatherData | null
  readonly keyPeople?: string | null
  readonly setMedic?: string | null
  readonly scriptVersion?: string | null
  readonly scheduleVersion?: string | null
  readonly notes?: string | null
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string
}

export type TalentCallStatus = "confirmed" | "pending" | "cancelled"

export interface TalentCallSheet {
  readonly id: string
  readonly talentId: string
  readonly callTime?: string | null
  readonly callText?: string | null
  readonly setTime?: string | null
  readonly wrapTime?: string | null
  readonly role?: string | null
  readonly status?: TalentCallStatus | null
  readonly notes?: string | null
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string
}

export type CallOffsetDirection = "early" | "delay"

export interface CrewCallSheet {
  readonly id: string
  readonly crewMemberId: string
  readonly callTime?: string | null
  readonly callText?: string | null
  readonly callOffsetDirection?: CallOffsetDirection | null
  readonly callOffsetMinutes?: number | null
  readonly wrapTime?: string | null
  readonly wrapText?: string | null
  readonly department?: string | null
  readonly position?: string | null
  readonly notes?: string | null
  readonly createdAt?: Timestamp
  readonly updatedAt?: Timestamp
  readonly createdBy?: string
}
