import type { Role } from "@/shared/types"

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Full access to everything. Manages team, projects, settings. Bypasses project membership.",
  producer: "Manages assigned projects: shots, schedules, pulls, talent, crew. Cannot manage team.",
  crew: "Works on assigned projects: can manage shots. Read access to schedules and pulls.",
  warehouse: "Fulfills pulls and manages products. Read access to project data.",
  viewer: "Read-only access to assigned projects. Cannot create or edit anything.",
}
