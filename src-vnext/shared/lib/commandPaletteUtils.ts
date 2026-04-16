import Fuse from "fuse.js"
import type {
  Project,
  ProductFamily,
  TalentRecord,
  CrewRecord,
  Shot,
  Pull,
  Lane,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EntityType =
  | "project"
  | "product"
  | "talent"
  | "crew"
  | "shot"
  | "pull"
  | "scene"

export interface SearchEntry {
  readonly id: string
  readonly type: EntityType
  readonly name: string
  readonly subtitle?: string
  readonly navigateTo: string
}

export interface RecentItem {
  readonly id: string
  readonly type: EntityType
  readonly name: string
  readonly subtitle?: string
  readonly navigateTo: string
}

// ---------------------------------------------------------------------------
// Recent items (localStorage)
// ---------------------------------------------------------------------------

const RECENT_KEY = "sb:cmd-recent"
const MAX_RECENT = 5

export function loadRecentItems(): ReadonlyArray<RecentItem> {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[]).filter(
      (r): r is RecentItem =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as Record<string, unknown>).id === "string" &&
        typeof (r as Record<string, unknown>).name === "string" &&
        typeof (r as Record<string, unknown>).navigateTo === "string",
    )
  } catch {
    return []
  }
}

export function saveRecentItem(item: RecentItem): void {
  const existing = loadRecentItems()
  const filtered = existing.filter((r) => r.id !== item.id || r.type !== item.type)
  const updated = [item, ...filtered].slice(0, MAX_RECENT)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated))
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

// ---------------------------------------------------------------------------
// Entity → SearchEntry mappers
// ---------------------------------------------------------------------------

export function mapProjectToEntry(project: Project): SearchEntry {
  return {
    id: project.id,
    type: "project",
    name: project.name,
    navigateTo: `/projects/${project.id}/shots`,
  }
}

export function mapProductToEntry(product: ProductFamily): SearchEntry {
  const subtitle = product.styleNumbers?.[0] ?? product.styleNumber ?? undefined
  return {
    id: product.id,
    type: "product",
    name: product.styleName,
    subtitle,
    navigateTo: `/products/${product.id}`,
  }
}

export function mapTalentToEntry(talent: TalentRecord): SearchEntry {
  return {
    id: talent.id,
    type: "talent",
    name: talent.name,
    subtitle: talent.agency ?? undefined,
    navigateTo: "/library/talent",
  }
}

export function mapCrewToEntry(crew: CrewRecord): SearchEntry {
  const subtitle = crew.position ?? crew.department ?? undefined
  return {
    id: crew.id,
    type: "crew",
    name: crew.name,
    subtitle,
    navigateTo: "/library/crew",
  }
}

// --- Lazy-indexed project-scoped entities (shots / pulls / scenes) ---

export function mapShotToEntry(shot: Shot): SearchEntry {
  const rawTitle = shot.title?.trim()
  const shotNumber = shot.shotNumber?.trim()
  const name = rawTitle && rawTitle.length > 0 ? rawTitle : shotNumber ?? "Untitled shot"
  const description = shot.description?.trim()
  let subtitle: string | undefined
  if (shotNumber) {
    subtitle = description ? `#${shotNumber} — ${description}` : `#${shotNumber}`
  } else if (description) {
    subtitle = description
  }
  return {
    id: shot.id,
    type: "shot",
    name,
    subtitle,
    navigateTo: `/projects/${shot.projectId}/shots/${shot.id}`,
  }
}

export function mapPullToEntry(pull: Pull): SearchEntry {
  const rawTitle = pull.title?.trim()
  const rawName = pull.name?.trim()
  const name =
    rawTitle && rawTitle.length > 0
      ? rawTitle
      : rawName && rawName.length > 0
        ? rawName
        : "Untitled pull"
  return {
    id: pull.id,
    type: "pull",
    name,
    subtitle: pull.status,
    navigateTo: `/projects/${pull.projectId}/pulls/${pull.id}`,
  }
}

export function mapLaneToSceneEntry(lane: Lane): SearchEntry {
  const laneName = lane.name?.trim() || "Untitled scene"
  const name =
    typeof lane.sceneNumber === "number"
      ? `#${lane.sceneNumber} ${laneName}`
      : laneName
  const subtitle = lane.direction?.trim() || lane.notes?.trim() || undefined
  // Navigate to the shots page in scene-grouped view with the target scene flagged
  // via `?scene=<laneId>`. ShotListPage consumes the param to switch the list into
  // `group=scene` mode and auto-expand the matching scene header.
  return {
    id: lane.id,
    type: "scene",
    name,
    subtitle,
    navigateTo: `/projects/${lane.projectId}/shots?scene=${lane.id}&group=scene`,
  }
}

// ---------------------------------------------------------------------------
// Fuse index factory
// ---------------------------------------------------------------------------

const FUSE_OPTIONS: Fuse.IFuseOptions<SearchEntry> = {
  keys: ["name", "subtitle"],
  threshold: 0.35,
  includeScore: true,
  minMatchCharLength: 1,
}

export function buildFuseIndex(entries: ReadonlyArray<SearchEntry>): Fuse<SearchEntry> {
  return new Fuse([...entries], FUSE_OPTIONS)
}

export function runFuseSearch(
  fuse: Fuse<SearchEntry>,
  query: string,
): ReadonlyArray<SearchEntry> {
  return fuse.search(query).map((r) => r.item)
}

// ---------------------------------------------------------------------------
// Group results by type
// ---------------------------------------------------------------------------

const MAX_PER_GROUP = 5

export interface GroupedResults {
  readonly projects: ReadonlyArray<SearchEntry>
  readonly products: ReadonlyArray<SearchEntry>
  readonly talent: ReadonlyArray<SearchEntry>
  readonly crew: ReadonlyArray<SearchEntry>
  readonly shots: ReadonlyArray<SearchEntry>
  readonly pulls: ReadonlyArray<SearchEntry>
  readonly scenes: ReadonlyArray<SearchEntry>
}

export function groupByType(entries: ReadonlyArray<SearchEntry>): GroupedResults {
  return entries.reduce<GroupedResults>(
    (acc, entry) => {
      if (entry.type === "project" && acc.projects.length < MAX_PER_GROUP) {
        return { ...acc, projects: [...acc.projects, entry] }
      }
      if (entry.type === "product" && acc.products.length < MAX_PER_GROUP) {
        return { ...acc, products: [...acc.products, entry] }
      }
      if (entry.type === "talent" && acc.talent.length < MAX_PER_GROUP) {
        return { ...acc, talent: [...acc.talent, entry] }
      }
      if (entry.type === "crew" && acc.crew.length < MAX_PER_GROUP) {
        return { ...acc, crew: [...acc.crew, entry] }
      }
      if (entry.type === "shot" && acc.shots.length < MAX_PER_GROUP) {
        return { ...acc, shots: [...acc.shots, entry] }
      }
      if (entry.type === "pull" && acc.pulls.length < MAX_PER_GROUP) {
        return { ...acc, pulls: [...acc.pulls, entry] }
      }
      if (entry.type === "scene" && acc.scenes.length < MAX_PER_GROUP) {
        return { ...acc, scenes: [...acc.scenes, entry] }
      }
      return acc
    },
    {
      projects: [],
      products: [],
      talent: [],
      crew: [],
      shots: [],
      pulls: [],
      scenes: [],
    },
  )
}

export function hasAnyResults(grouped: GroupedResults): boolean {
  return (
    grouped.projects.length > 0 ||
    grouped.products.length > 0 ||
    grouped.talent.length > 0 ||
    grouped.crew.length > 0 ||
    grouped.shots.length > 0 ||
    grouped.pulls.length > 0 ||
    grouped.scenes.length > 0
  )
}
