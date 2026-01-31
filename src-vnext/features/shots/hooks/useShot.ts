import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreDoc } from "@/shared/hooks/useFirestoreDoc"
import { shotPath } from "@/shared/lib/paths"
import type { Shot } from "@/shared/types"

function mapShot(id: string, data: Record<string, unknown>): Shot {
  return {
    id,
    title: (data["title"] as string) ?? "",
    description: data["description"] as string | undefined,
    projectId: (data["projectId"] as string) ?? "",
    clientId: (data["clientId"] as string) ?? "",
    status: (data["status"] as Shot["status"]) ?? "todo",
    talent: (data["talent"] as string[]) ?? [],
    talentIds: data["talentIds"] as string[] | undefined,
    products: (data["products"] as Shot["products"]) ?? [],
    locationId: data["locationId"] as string | undefined,
    locationName: data["locationName"] as string | undefined,
    laneId: data["laneId"] as string | undefined,
    sortOrder: (data["sortOrder"] as number) ?? 0,
    notes: data["notes"] as string | undefined,
    date: data["date"] as Shot["date"],
    heroImage: data["heroImage"] as Shot["heroImage"],
    deleted: data["deleted"] as boolean | undefined,
    createdAt: data["createdAt"] as Shot["createdAt"],
    updatedAt: data["updatedAt"] as Shot["updatedAt"],
    createdBy: (data["createdBy"] as string) ?? "",
  }
}

export function useShot(shotId: string | undefined) {
  const { clientId } = useAuth()

  return useFirestoreDoc<Shot>(
    clientId && shotId ? shotPath(shotId, clientId) : null,
    mapShot,
  )
}
