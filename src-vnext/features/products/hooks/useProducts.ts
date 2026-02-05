import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import {
  productFamiliesPath,
  productFamilySkusPath,
} from "@/shared/lib/paths"
import type { ProductFamily, ProductSku } from "@/shared/types"
import { mapProductFamily, mapProductSku } from "@/features/products/lib/mapProduct"

export function useProductFamilies() {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductFamily>(
    clientId ? productFamiliesPath(clientId) : null,
    [orderBy("styleName", "asc")],
    mapProductFamily,
  )
}

export function useProductFamily(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreDoc<ProductFamily>(
    clientId && familyId
      ? [...productFamiliesPath(clientId), familyId]
      : null,
    mapProductFamily,
  )
}

export function useProductSkus(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductSku>(
    clientId && familyId ? productFamilySkusPath(familyId, clientId) : null,
    [],
    mapProductSku,
  )
}
