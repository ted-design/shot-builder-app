import type { Timestamp } from "firebase/firestore"

export type Role = "admin" | "producer" | "crew" | "warehouse" | "viewer"

export type ProjectStatus = "active" | "completed" | "archived"

export interface Project {
  readonly id: string
  readonly name: string
  readonly clientId: string
  readonly status: ProjectStatus
  readonly shootDates: Timestamp[]
  readonly notes?: string
  readonly briefUrl?: string
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

export type ShotFirestoreStatus = "todo" | "in_progress" | "complete" | "on_hold"

export interface ProductAssignment {
  readonly familyId: string
  readonly familyName?: string
  readonly skuId?: string
  readonly skuName?: string
  readonly colourId?: string
  readonly colourName?: string
  readonly size?: string
  readonly quantity?: number
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
  readonly notes?: string
  readonly date?: Timestamp
  readonly heroImage?: { readonly path: string; readonly downloadURL: string }
  readonly deleted?: boolean
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
  readonly createdBy: string
}

export type PullFirestoreStatus = "draft" | "in-progress" | "fulfilled"

export type FulfillmentFirestoreStatus =
  | "pending"
  | "fulfilled"
  | "partial"
  | "substituted"

export interface PullItemSize {
  readonly size: string
  readonly quantity: number
  readonly fulfilled: boolean
}

export interface ChangeOrder {
  readonly id: string
  readonly type: string
  readonly description: string
  readonly status: string
  readonly createdAt: Timestamp
}

export interface PullItem {
  readonly familyId: string
  readonly familyName?: string
  readonly colourId?: string
  readonly colourName?: string
  readonly sizes: PullItemSize[]
  readonly fulfillmentStatus: FulfillmentFirestoreStatus
  readonly notes?: string
  readonly changeOrders: ChangeOrder[]
}

export interface Pull {
  readonly id: string
  readonly projectId: string
  readonly clientId: string
  readonly name?: string
  readonly shotIds: string[]
  readonly items: PullItem[]
  readonly status: PullFirestoreStatus
  readonly shareToken?: string
  readonly shareEnabled: boolean
  readonly exportSettings?: Record<string, unknown>
  readonly createdAt: Timestamp
  readonly updatedAt: Timestamp
}

export interface ProductFamily {
  readonly id: string
  readonly styleName: string
  readonly styleNumber?: string
  readonly category?: string
  readonly imageUrl?: string
  readonly clientId: string
}

export interface ProductSku {
  readonly id: string
  readonly name: string
  readonly colour?: string
  readonly colourHex?: string
  readonly size?: string
  readonly sku?: string
}

export interface TalentRecord {
  readonly id: string
  readonly name: string
  readonly imageUrl?: string
  readonly agency?: string
  readonly notes?: string
}

export interface LocationRecord {
  readonly id: string
  readonly name: string
  readonly address?: string
  readonly notes?: string
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
