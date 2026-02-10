import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { productClassificationsPath } from "@/shared/lib/paths"
import type { ProductClassification } from "@/shared/types"
import { mapProductClassificationDoc } from "@/features/products/lib/productClassifications"

export function useProductClassifications() {
  const { clientId } = useAuth()
  return useFirestoreCollection<ProductClassification>(
    clientId ? productClassificationsPath(clientId) : null,
    [],
    mapProductClassificationDoc,
  )
}
