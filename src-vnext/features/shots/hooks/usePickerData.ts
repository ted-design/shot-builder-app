import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
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
    imageUrl: data["imageUrl"] as string | undefined,
    clientId: (data["clientId"] as string) ?? "",
  }
}

function mapSku(id: string, data: Record<string, unknown>): ProductSku {
  return {
    id,
    name: (data["name"] as string) ?? "",
    colour: data["colour"] as string | undefined,
    colourHex: data["colourHex"] as string | undefined,
    size: data["size"] as string | undefined,
    sku: data["sku"] as string | undefined,
  }
}

function mapTalent(id: string, data: Record<string, unknown>): TalentRecord {
  return {
    id,
    name: (data["name"] as string) ?? "",
    imageUrl: data["imageUrl"] as string | undefined,
    agency: data["agency"] as string | undefined,
    notes: data["notes"] as string | undefined,
  }
}

function mapLocation(id: string, data: Record<string, unknown>): LocationRecord {
  return {
    id,
    name: (data["name"] as string) ?? "",
    address: data["address"] as string | undefined,
    notes: data["notes"] as string | undefined,
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
