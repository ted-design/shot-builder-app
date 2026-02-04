import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import {
  productFamiliesPath,
  productFamilySkusPath,
  talentPath,
  locationsPath,
} from "@/shared/lib/paths"
import type { ProductFamily, ProductSku, TalentRecord, LocationRecord } from "@/shared/types"

function mapFamily(id: string, data: Record<string, unknown>): ProductFamily {
  return {
    id,
    styleName: (data["styleName"] as string) ?? "",
    styleNumber: data["styleNumber"] as string | undefined,
    category: data["category"] as string | undefined,
    headerImagePath: data["headerImagePath"] as string | undefined,
    thumbnailImagePath: data["thumbnailImagePath"] as string | undefined,
    clientId: (data["clientId"] as string) ?? "",
  }
}

function mapSku(id: string, data: Record<string, unknown>): ProductSku {
  const rawSizes = data["sizes"]
  return {
    id,
    name: (data["colorName"] as string) ?? (data["name"] as string) ?? "",
    colorName: (data["colorName"] as string) ?? (data["name"] as string) ?? undefined,
    colourHex: (data["hexColor"] as string) ?? (data["colourHex"] as string) ?? undefined,
    sizes: Array.isArray(rawSizes) ? (rawSizes as string[]) : [],
    skuCode: (data["skuCode"] as string) ?? (data["sku"] as string) ?? undefined,
    imagePath: data["imagePath"] as string | undefined,
  }
}

function mapTalent(id: string, data: Record<string, unknown>): TalentRecord {
  const rawProjectIds = data["projectIds"]
  return {
    id,
    name: (data["name"] as string) ?? "",
    imageUrl: data["imageUrl"] as string | undefined,
    agency: data["agency"] as string | undefined,
    notes: data["notes"] as string | undefined,
    projectIds: Array.isArray(rawProjectIds) ? (rawProjectIds as string[]) : undefined,
  }
}

function mapLocation(id: string, data: Record<string, unknown>): LocationRecord {
  const rawProjectIds = data["projectIds"]
  return {
    id,
    name: (data["name"] as string) ?? "",
    address: data["address"] as string | undefined,
    notes: data["notes"] as string | undefined,
    projectIds: Array.isArray(rawProjectIds) ? (rawProjectIds as string[]) : undefined,
  }
}

export function useProductFamilies() {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductFamily>(
    clientId ? productFamiliesPath(clientId) : null,
    [orderBy("styleName", "asc")],
    mapFamily,
  )
}

export function useProductSkus(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductSku>(
    clientId && familyId ? productFamilySkusPath(familyId, clientId) : null,
    [],
    mapSku,
  )
}

export function useProductFamilyDoc(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreDoc<ProductFamily>(
    clientId && familyId ? [...productFamiliesPath(clientId), familyId] : null,
    mapFamily,
  )
}

export function useProductSkuDoc(
  familyId: string | null,
  skuId: string | null,
) {
  const { clientId } = useAuth()
  return useFirestoreDoc<ProductSku>(
    clientId && familyId && skuId
      ? [...productFamilySkusPath(familyId, clientId), skuId]
      : null,
    mapSku,
  )
}

export function useTalent() {
  const { clientId } = useAuth()
  return useFirestoreCollection<TalentRecord>(
    clientId ? talentPath(clientId) : null,
    [orderBy("name", "asc")],
    mapTalent,
  )
}

export function useLocations() {
  const { clientId } = useAuth()
  return useFirestoreCollection<LocationRecord>(
    clientId ? locationsPath(clientId) : null,
    [orderBy("name", "asc")],
    mapLocation,
  )
}
