import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"

export interface TalentDependency {
  readonly id: string
  readonly title: string
  readonly projectId?: string
}

export interface TalentDependencies {
  readonly shots: readonly TalentDependency[]
  readonly castingBoardProjects: readonly TalentDependency[]
  readonly totalReferences: number
}

export async function checkTalentDependencies(args: {
  readonly clientId: string
  readonly talentId: string
  readonly projectIds?: readonly string[]
}): Promise<TalentDependencies> {
  const { clientId, talentId } = args

  // Query shots referencing this talent — NO server-side deleted filter
  // (docs without `deleted` field would be excluded by where("deleted","==",false))
  const shotsRef = collection(db, "clients", clientId, "shots")
  const shotsQuery = query(
    shotsRef,
    where("talentIds", "array-contains", talentId),
  )

  let shots: TalentDependency[] = []
  try {
    const snap = await getDocs(shotsQuery)
    shots = snap.docs
      .filter((d) => d.data()["deleted"] !== true) // client-side filter
      .slice(0, 50)
      .map((d) => {
        const data = d.data()
        return {
          id: d.id,
          title: typeof data["shotNumber"] === "string" ? data["shotNumber"] : d.id,
          projectId: typeof data["projectId"] === "string" ? data["projectId"] : undefined,
        }
      })
  } catch (err) {
    console.error("[checkTalentDependencies] shots query failed:", err)
  }

  // Check casting board entries — immutable map pattern (no mutation)
  const projectIds = args.projectIds ?? []
  const castingEntries = await Promise.all(
    projectIds.map(async (projectId): Promise<TalentDependency | null> => {
      try {
        const entryRef = doc(
          db,
          "clients",
          clientId,
          "projects",
          projectId,
          "castingBoard",
          talentId,
        )
        const snap = await getDoc(entryRef)
        if (snap.exists()) {
          return { id: projectId, title: projectId }
        }
        return null
      } catch {
        return null
      }
    }),
  )
  const castingBoardProjects = castingEntries.filter(
    (e): e is TalentDependency => e !== null,
  )

  return {
    shots,
    castingBoardProjects,
    totalReferences: shots.length + castingBoardProjects.length,
  }
}
