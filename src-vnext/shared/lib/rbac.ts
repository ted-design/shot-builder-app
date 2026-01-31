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

export function resolveEffectiveRole(
  globalRole: unknown,
  projectRoles?: Record<string, unknown>,
  projectId?: string | null,
): Role {
  if (projectId && projectRoles) {
    const projectRole = projectRoles[projectId]
    if (typeof projectRole === "string" && projectRole.trim().length > 0) {
      return normalizeRole(projectRole)
    }
  }
  return normalizeRole(globalRole)
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

export function canManagePulls(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.PRODUCER || role === ROLE.WAREHOUSE
}

export function canFulfillPulls(role: Role): boolean {
  return role === ROLE.ADMIN || role === ROLE.WAREHOUSE
}

export function isViewer(role: Role): boolean {
  return role === ROLE.VIEWER
}
