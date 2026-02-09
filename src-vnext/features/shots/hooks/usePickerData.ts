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

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string" && v.length > 0)
}

function mapFamily(id: string, data: Record<string, unknown>): ProductFamily {
  const productType =
    asString(data["productType"]) ??
    asString(data["type"]) ??
    undefined

  const productSubcategory =
    asString(data["productSubcategory"]) ??
    asString(data["subcategory"]) ??
    undefined

  const category =
    asString(data["category"]) ??
    productSubcategory ??
    productType

  return {
    id,
    styleName: asString(data["styleName"]) ?? "",
    styleNumber: asString(data["styleNumber"]),
    previousStyleNumber: asString(data["previousStyleNumber"]),
    category,
    gender: asString(data["gender"]) ?? null,
    productType,
    productSubcategory,
    status: asString(data["status"]) ?? "active",
    archived: asBoolean(data["archived"]) ?? false,
    notes: data["notes"] as ProductFamily["notes"],
    headerImagePath: asString(data["headerImagePath"]),
    thumbnailImagePath: asString(data["thumbnailImagePath"]),
    sizes: asStringArray(data["sizes"]),
    skuCount: asNumber(data["skuCount"]),
    activeSkuCount: asNumber(data["activeSkuCount"]),
    skuCodes: asStringArray(data["skuCodes"]),
    colorNames: asStringArray(data["colorNames"]),
    sizeOptions: asStringArray(data["sizeOptions"]),
    shotIds: asStringArray(data["shotIds"]),
    deleted: asBoolean(data["deleted"]),
    clientId: asString(data["clientId"]) ?? "",
  }
}

function mapSku(id: string, data: Record<string, unknown>): ProductSku {
  const colorName = asString(data["colorName"]) ?? asString(data["name"]) ?? ""
  const hexColor = asString(data["hexColor"]) ?? asString(data["colourHex"])

  return {
    id,
    name: colorName,
    colorName,
    colourHex: hexColor,
    hexColor,
    sizes: asStringArray(data["sizes"]),
    status: asString(data["status"]) ?? "active",
    archived: asBoolean(data["archived"]) ?? false,
    skuCode: asString(data["skuCode"]) ?? asString(data["sku"]),
    imagePath: asString(data["imagePath"]),
    colorKey: asString(data["colorKey"]),
    deleted: asBoolean(data["deleted"]),
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
