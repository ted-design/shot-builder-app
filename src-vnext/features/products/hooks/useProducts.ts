import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import {
  productFamiliesPath,
  productFamilySkusPath,
} from "@/shared/lib/paths"
import type { ProductFamily, ProductSku } from "@/shared/types"

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
    colorName:
      (data["colorName"] as string) ?? (data["name"] as string) ?? undefined,
    colourHex:
      (data["hexColor"] as string) ?? (data["colourHex"] as string) ?? undefined,
    sizes: Array.isArray(rawSizes) ? (rawSizes as string[]) : [],
    skuCode:
      (data["skuCode"] as string) ?? (data["sku"] as string) ?? undefined,
    imagePath: data["imagePath"] as string | undefined,
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

export function useProductFamily(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreDoc<ProductFamily>(
    clientId && familyId
      ? [...productFamiliesPath(clientId), familyId]
      : null,
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
