import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import {
  productFamilyCommentsPath,
  productFamilyDocumentsPath,
  productFamilySamplesPath,
} from "@/shared/lib/paths"
import type { ProductComment, ProductDocument, ProductSample } from "@/shared/types"
import {
  mapProductComment,
  mapProductDocument,
  mapProductSample,
} from "@/features/products/lib/mapProductWorkspace"

export function useProductSamples(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductSample>(
    clientId && familyId ? productFamilySamplesPath(familyId, clientId) : null,
    [orderBy("createdAt", "desc")],
    mapProductSample,
  )
}

export function useProductComments(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductComment>(
    clientId && familyId ? productFamilyCommentsPath(familyId, clientId) : null,
    [orderBy("createdAt", "desc")],
    mapProductComment,
  )
}

export function useProductDocuments(familyId: string | null) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductDocument>(
    clientId && familyId ? productFamilyDocumentsPath(familyId, clientId) : null,
    [orderBy("createdAt", "desc")],
    mapProductDocument,
  )
}

