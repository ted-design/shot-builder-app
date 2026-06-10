import type { Role } from "@/shared/types"

export const ROLE = {
  ADMIN: "admin",
  PRODUCER: "producer",
  CREW: "crew",
  WAREHOUSE: "warehouse",
  VIEWER: "viewer",
} as const satisfies Record<string, Role>

export function normalizeRole(role: unknown): Role {
  if (typeof role !== "string") return ROLE.VIEWER
  const lower = role.trim().toLowerCase()
  // Legacy alias: firestore.rules (normalizedRole, :43-56) maps 'wardrobe' →
  // warehouse. Mirror it here so legacy-wardrobe users land on the same JOB
  // the rules grant writes for (Phase 4 spec, security invariant 5).
  if (lower === "wardrobe") return ROLE.WAREHOUSE
  if (
    lower === ROLE.ADMIN ||
    lower === ROLE.PRODUCER ||
    lower === ROLE.CREW ||
    lower === ROLE.WAREHOUSE ||
    lower === ROLE.VIEWER
  ) {
    return lower
  }
  return ROLE.VIEWER
}

export function roleLabel(role: Role): string {
  switch (role) {
    case ROLE.ADMIN:
      return "Admin"
    case ROLE.PRODUCER:
      return "Producer"
    case ROLE.CREW:
      return "Crew"
    case ROLE.WAREHOUSE:
      return "Warehouse"
    case ROLE.VIEWER:
      return "Viewer"
  }
}

export function canManageProjects(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManageShots(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER || role === ROLE.CREW
}

export function canManageSchedules(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManageProducts(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canGeneratePulls(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManagePulls(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER || role === ROLE.WAREHOUSE
}

export function canFulfillPulls(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.WAREHOUSE
}

export function canManageTalent(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManageCrew(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManageLocations(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function isViewer(role: Role): boolean {
  return role === ROLE.VIEWER
}

export function isAdmin(role: Role): boolean {
  return role === ROLE.ADMIN
}

export function canSubmitShotRequest(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canTriageShotRequests(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

export function canManageCasting(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER
}

// Scene/lane writes (create scene, edit, delete, ungroup). Mirrors the
// /lanes rule, which is already project-aware: create/update at
// firestore.rules:880-882 and delete at :901-904 both gate on isAdmin ||
// producerCanAccessProject || hasProjectRole(projectId, ['producer',
// 'warehouse']). Consumes the EFFECTIVE role (5b) — the two surviving
// copies (ShotListPage canManageLanes, ShotDetailPageUnified canEditScene)
// consolidate here. 5f's warehouse revoke is a two-line edit: remove
// 'warehouse' from this helper AND from the lanes rule role lists.
export function canEditScene(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER || role === ROLE.WAREHOUSE
}

// Total order over roles for "is this a downgrade" comparisons (the 5b
// effective-role chip + mid-session downgrade toast). admin > producer >
// crew/warehouse > viewer. Crew and warehouse are LATERAL jobs (crew writes
// shots, warehouse writes lanes/pulls) — they share a rank on purpose, so a
// crew<->warehouse project override is neither a downgrade nor an upgrade.
const ROLE_RANK: Record<Role, number> = {
  [ROLE.ADMIN]: 4,
  [ROLE.PRODUCER]: 3,
  [ROLE.CREW]: 2,
  [ROLE.WAREHOUSE]: 2,
  [ROLE.VIEWER]: 1,
}

export function roleRank(role: Role): number {
  return ROLE_RANK[role]
}
