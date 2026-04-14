import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  breadcrumbsConfig,
  KNOWN_ROUTE_PATTERNS,
  type BreadcrumbContext,
} from "@/app/routes/breadcrumbs"

function ctx(partial: Partial<BreadcrumbContext> = {}): BreadcrumbContext {
  return {
    params: partial.params ?? {},
    projectName: partial.projectName,
    trailingLabel: partial.trailingLabel,
  }
}

describe("breadcrumbsConfig", () => {
  it("has a resolver for every known route pattern", () => {
    for (const pattern of KNOWN_ROUTE_PATTERNS) {
      expect(typeof breadcrumbsConfig[pattern]).toBe("function")
    }
  })

  it("resolves the project ancestry for project-scoped routes", () => {
    const trail = breadcrumbsConfig["/projects/:id/callsheet"]!(
      ctx({ params: { id: "p1" }, projectName: "Acme Spring" }),
    )
    expect(trail).toEqual([
      { label: "Projects", to: "/projects" },
      { label: "Acme Spring", to: "/projects/p1/shots" },
      { label: "Call Sheet" },
    ])
  })

  it("falls back to 'Project' when no projectName is available", () => {
    const trail = breadcrumbsConfig["/projects/:id/shots"]!(
      ctx({ params: { id: "p1" } }),
    )
    expect(trail[trail.length - 1]!.label).toBe("Project")
  })

  it("uses the trailingLabel for dynamic entity routes", () => {
    const trail = breadcrumbsConfig["/projects/:id/shots/:sid"]!(
      ctx({ params: { id: "p1", sid: "s1" }, projectName: "Acme", trailingLabel: "#47" }),
    )
    expect(trail[trail.length - 1]).toEqual({ label: "#47" })
  })

  it("returns empty for root-level dashboards", () => {
    expect(breadcrumbsConfig["/projects"]!(ctx())).toEqual([])
  })

  it("library routes use the static Library ancestor", () => {
    const trail = breadcrumbsConfig["/library/talent"]!(ctx())
    expect(trail).toEqual([{ label: "Library" }, { label: "Talent" }])
  })

  it("every trail's final crumb never has a `to` (current page)", () => {
    const testCtx = ctx({
      params: { id: "p1", sid: "s1", pid: "pu1", fid: "f1", locationId: "l1", crewId: "c1", scheduleId: "sched1" },
      projectName: "Test",
      trailingLabel: "Entity",
    })
    for (const [pattern, resolver] of Object.entries(breadcrumbsConfig)) {
      const trail = resolver(testCtx)
      if (trail.length === 0) continue
      const last = trail[trail.length - 1]!
      expect(
        last.to,
        `Pattern ${pattern} has a linkable final crumb — current page should not self-link`,
      ).toBeUndefined()
    }
  })

  it("covers every authenticated <Route path=...> in routes/index.tsx", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src-vnext/app/routes/index.tsx"),
      "utf8",
    )
    const matches = [...source.matchAll(/<Route[^>]*\bpath="([^"]+)"/g)].map(
      (m) => m[1]!,
    )
    // Strip public / auth / wildcard routes — those never render inside
    // AppShell and therefore don't need breadcrumbs.
    const skip = new Set([
      "/login",
      "/pulls/shared/:shareToken",
      "/pulls/shared/:shareToken/guide",
      "/shots/shared/:shareToken",
      "/casting/shared/:shareToken",
      "*",
      // Dev-only imports — unreachable in production, not worth wiring.
      "dev/import-q2",
      "dev/import-q2-shots",
      "dev/import-q1-hub-shots",
    ])
    const authenticated = matches
      .filter((p) => !skip.has(p))
      .map((p) => (p.startsWith("/") ? p : `/${p}`))
    const covered = new Set(KNOWN_ROUTE_PATTERNS)
    const missing = authenticated.filter((p) => !covered.has(p))
    expect(
      missing,
      `routes/index.tsx defines route patterns not in breadcrumbsConfig: ${missing.join(", ")}`,
    ).toEqual([])
  })
})
