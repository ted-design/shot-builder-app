import { orderBy } from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { talentPath } from "@/shared/lib/paths"
import type { TalentRecord } from "@/shared/types"

function mapTalent(id: string, data: Record<string, unknown>): TalentRecord {
  const rawProjectIds = data["projectIds"]
  return {
    id,
    name: (data["name"] as string) ?? "",
    firstName: (data["firstName"] as string) ?? null,
    lastName: (data["lastName"] as string) ?? null,
    agency: data["agency"] as string | undefined,
    email: (data["email"] as string) ?? null,
    phone: (data["phone"] as string) ?? null,
    url: (data["url"] as string) ?? null,
    gender: (data["gender"] as string) ?? null,
    measurements:
      (data["measurements"] as TalentRecord["measurements"]) ?? null,
    notes: (data["notes"] as string) ?? (data["sizing"] as string) ?? undefined,
    imageUrl: (data["imageUrl"] as string) ?? undefined,
    headshotPath: (data["headshotPath"] as string) ?? null,
    headshotUrl: (data["headshotUrl"] as string) ?? null,
    galleryImages:
      (data["galleryImages"] as TalentRecord["galleryImages"]) ?? undefined,
    projectIds: Array.isArray(rawProjectIds) ? (rawProjectIds as string[]) : undefined,
  }
}

export function useTalentLibrary() {
  const { clientId } = useAuth()
  return useFirestoreCollection<TalentRecord>(
    clientId ? talentPath(clientId) : null,
    [orderBy("name", "asc")],
    mapTalent,
  )
}
