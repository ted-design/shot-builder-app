import { limit, orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { productFamilyVersionsPath } from "@/shared/lib/paths"
import { mapProductVersion } from "@/features/products/lib/mapProductVersion"
import type { ProductVersion } from "@/shared/types"

export function useProductVersions(familyId: string | null, maxVersions = 25) {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductVersion>(
    clientId && familyId ? productFamilyVersionsPath(familyId, clientId) : null,
    [orderBy("createdAt", "desc"), limit(maxVersions)],
    mapProductVersion,
  )
}
