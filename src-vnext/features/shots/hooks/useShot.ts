import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { shotPath } from "@/shared/lib/paths"
import { mapShot } from "@/features/shots/lib/mapShot"
import type { Shot } from "@/shared/types"

export function useShot(shotId: string | undefined) {
  const { clientId } = useAuth()

  return useFirestoreDoc<Shot>(
    clientId && shotId ? shotPath(shotId, clientId) : null,
    mapShot,
  )
}
