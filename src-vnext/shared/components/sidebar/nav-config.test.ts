import { describe, it, expect } from "vitest"
import {
  buildNavConfig,
  getMobileNavConfig,
  withProductInfoReportsNav,
  withShotReportsNav,
  withTalentReportsNav,
  type NavConfig,
} from "./nav-config"

describe("buildNavConfig", () => {
  it("returns org variant when no projectId", () => {
    const config = buildNavConfig()
    expect(config.variant).toBe("org")
  })

  it("returns project variant with projectId", () => {
    const config = buildNavConfig("abc123")
    expect(config.variant).toBe("project")
  })

  it("org config has Dashboard, Products, Library group", () => {
    const config = buildNavConfig()
    const labels = config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)
    expect(labels).toContain("Dashboard")
    expect(labels).toContain("Products")

    const groups = config.entries.filter((e) => e.type === "group")
    expect(groups).toHaveLength(1)
  })

  it("project config includes back link and project items", () => {
    const config = buildNavConfig("p1")
    const backLinks = config.entries.filter((e) => e.type === "back-link")
    expect(backLinks).toHaveLength(1)

    const items = config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)
    expect(items).toContain("Shots")
    expect(items).toContain("Pulls")
    expect(items).toContain("Assets")
    expect(items).toContain("Call Sheet")
  })

  it("Library group has 4 children", () => {
    const config = buildNavConfig()
    const group = config.entries.find((e) => e.type === "group")
    expect(group).toBeDefined()
    if (group?.type === "group") {
      expect(group.group.children).toHaveLength(4)
      const names = group.group.children.map((c) => c.label)
      expect(names).toEqual(["Talent", "Crew", "Locations", "Palette"])
    }
  })

  it("Call Sheet is marked desktopOnly", () => {
    const config = buildNavConfig("p1")
    const callSheet = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Call Sheet",
    )
    expect(callSheet).toBeDefined()
    if (callSheet?.type === "item") {
      expect(callSheet.item.desktopOnly).toBe(true)
    }
  })

  it("project paths include projectId", () => {
    const config = buildNavConfig("xyz")
    const shots = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Shots",
    )
    if (shots?.type === "item") {
      expect(shots.item.to).toBe("/projects/xyz/shots")
    }
  })

  it("includes Admin entry for admin role in org view", () => {
    const config = buildNavConfig(undefined, "admin")
    const admin = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Admin",
    )
    expect(admin).toBeDefined()
    if (admin?.type === "item") {
      expect(admin.item.to).toBe("/admin")
      expect(admin.item.desktopOnly).toBe(true)
    }
  })

  it("excludes Admin entry for non-admin roles", () => {
    const config = buildNavConfig(undefined, "producer")
    const admin = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Admin",
    )
    expect(admin).toBeUndefined()
  })

  it("excludes Admin entry when no role provided", () => {
    const config = buildNavConfig()
    const admin = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Admin",
    )
    expect(admin).toBeUndefined()
  })

  it("includes Request Centre entry for admin role in org view", () => {
    const config = buildNavConfig(undefined, "admin")
    const reqCentre = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Request Centre",
    )
    expect(reqCentre).toBeDefined()
    if (reqCentre?.type === "item") {
      expect(reqCentre.item.to).toBe("/requests")
      expect(reqCentre.item.iconName).toBe("clipboard-check")
    }
  })

  it("includes Request Centre entry for producer role in org view", () => {
    const config = buildNavConfig(undefined, "producer")
    const reqCentre = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Request Centre",
    )
    expect(reqCentre).toBeDefined()
  })

  it("excludes Request Centre entry for crew role", () => {
    const config = buildNavConfig(undefined, "crew")
    const reqCentre = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Request Centre",
    )
    expect(reqCentre).toBeUndefined()
  })

  it("excludes Request Centre entry for warehouse role", () => {
    const config = buildNavConfig(undefined, "warehouse")
    const reqCentre = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Request Centre",
    )
    expect(reqCentre).toBeUndefined()
  })

  it("excludes Request Centre entry for viewer role", () => {
    const config = buildNavConfig(undefined, "viewer")
    const reqCentre = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Request Centre",
    )
    expect(reqCentre).toBeUndefined()
  })

  it("places Request Centre between Dashboard and Products for admin", () => {
    const config = buildNavConfig(undefined, "admin")
    const items = config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)
    const dashIdx = items.indexOf("Dashboard")
    const reqIdx = items.indexOf("Request Centre")
    const productsIdx = items.indexOf("Products")
    expect(reqIdx).toBeGreaterThan(dashIdx)
    expect(reqIdx).toBeLessThan(productsIdx)
  })
})

describe("getMobileNavConfig", () => {
  it("replaces Library group with flat item", () => {
    const config = getMobileNavConfig()
    const groups = config.entries.filter((e) => e.type === "group")
    expect(groups).toHaveLength(0)

    const libraryItem = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Library",
    )
    expect(libraryItem).toBeDefined()
    if (libraryItem?.type === "item") {
      expect(libraryItem.item.to).toBe("/library/talent")
    }
  })

  it("excludes desktop-only items", () => {
    const config = getMobileNavConfig("p1")
    const items = config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)
    expect(items).not.toContain("Call Sheet")
  })

  it("does not have consecutive dividers", () => {
    const config = getMobileNavConfig("p1")
    for (let i = 1; i < config.entries.length; i++) {
      if (config.entries[i].type === "divider") {
        expect(config.entries[i - 1].type).not.toBe("divider")
      }
    }
  })

  it("excludes Admin entry on mobile even for admin role", () => {
    const config = getMobileNavConfig(undefined, "admin")
    const admin = config.entries.find(
      (e) => e.type === "item" && e.item.label === "Admin",
    )
    expect(admin).toBeUndefined()
  })
})

describe("withShotReportsNav", () => {
  const itemLabels = (config: NavConfig) =>
    config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)

  it("inserts a Shot Reports item right after Export", () => {
    const labels = itemLabels(withShotReportsNav(buildNavConfig("p1"), "p1"))
    const exportIdx = labels.indexOf("Export")
    expect(exportIdx).toBeGreaterThanOrEqual(0)
    expect(labels[exportIdx + 1]).toBe("Shot Reports")
  })

  it("points the item at the project-scoped reports route", () => {
    const next = withShotReportsNav(buildNavConfig("p1"), "p1")
    const item = next.entries.find((e) => e.type === "item" && e.item.label === "Shot Reports")
    expect(item && item.type === "item" ? item.item.to : null).toBe("/projects/p1/export/reports")
  })

  it("appends Shot Reports when no Export entry exists (fallback)", () => {
    const stub: NavConfig = {
      variant: "project",
      entries: [{ type: "item", item: { label: "Shots", to: "/projects/p1/shots", iconName: "camera" } }],
    }
    const next = withShotReportsNav(stub, "p1")
    const last = next.entries[next.entries.length - 1]
    expect(last && last.type === "item" ? last.item.label : null).toBe("Shot Reports")
  })

  it("does not mutate the input config", () => {
    const base = buildNavConfig("p1")
    const beforeLen = base.entries.length
    withShotReportsNav(base, "p1")
    expect(base.entries.length).toBe(beforeLen)
    expect(base.entries.some((e) => e.type === "item" && e.item.label === "Shot Reports")).toBe(false)
  })
})

describe("withProductInfoReportsNav", () => {
  const itemLabels = (config: NavConfig) =>
    config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)

  it("inserts a Product Info item right after Shot Reports when present", () => {
    const withShots = withShotReportsNav(buildNavConfig("p1"), "p1")
    const labels = itemLabels(withProductInfoReportsNav(withShots, "p1"))
    const shotIdx = labels.indexOf("Shot Reports")
    expect(shotIdx).toBeGreaterThanOrEqual(0)
    expect(labels[shotIdx + 1]).toBe("Product Info")
  })

  it("inserts a Product Info item right after Export when Shot Reports absent", () => {
    const labels = itemLabels(withProductInfoReportsNav(buildNavConfig("p1"), "p1"))
    const exportIdx = labels.indexOf("Export")
    expect(exportIdx).toBeGreaterThanOrEqual(0)
    expect(labels[exportIdx + 1]).toBe("Product Info")
  })

  it("points the item at the project-scoped product-reports route", () => {
    const next = withProductInfoReportsNav(buildNavConfig("p1"), "p1")
    const item = next.entries.find((e) => e.type === "item" && e.item.label === "Product Info")
    expect(item && item.type === "item" ? item.item.to : null).toBe(
      "/projects/p1/export/product-reports",
    )
  })

  it("appends Product Info when no Export entry exists (fallback)", () => {
    const stub: NavConfig = {
      variant: "project",
      entries: [{ type: "item", item: { label: "Shots", to: "/projects/p1/shots", iconName: "camera" } }],
    }
    const next = withProductInfoReportsNav(stub, "p1")
    const last = next.entries[next.entries.length - 1]
    expect(last && last.type === "item" ? last.item.label : null).toBe("Product Info")
  })

  it("does not mutate the input config", () => {
    const base = buildNavConfig("p1")
    const beforeLen = base.entries.length
    withProductInfoReportsNav(base, "p1")
    expect(base.entries.length).toBe(beforeLen)
    expect(base.entries.some((e) => e.type === "item" && e.item.label === "Product Info")).toBe(false)
  })
})

describe("withTalentReportsNav", () => {
  const itemLabels = (config: NavConfig) =>
    config.entries
      .filter((e) => e.type === "item")
      .map((e) => (e as { type: "item"; item: { label: string } }).item.label)

  it("inserts a Talent item right after Product Info when present", () => {
    const withProduct = withProductInfoReportsNav(
      withShotReportsNav(buildNavConfig("p1"), "p1"),
      "p1",
    )
    const labels = itemLabels(withTalentReportsNav(withProduct, "p1"))
    const productIdx = labels.indexOf("Product Info")
    expect(productIdx).toBeGreaterThanOrEqual(0)
    expect(labels[productIdx + 1]).toBe("Talent Reports")
  })

  it("inserts a Talent item right after Shot Reports when Product Info absent", () => {
    const withShots = withShotReportsNav(buildNavConfig("p1"), "p1")
    const labels = itemLabels(withTalentReportsNav(withShots, "p1"))
    const shotIdx = labels.indexOf("Shot Reports")
    expect(shotIdx).toBeGreaterThanOrEqual(0)
    expect(labels[shotIdx + 1]).toBe("Talent Reports")
  })

  it("inserts a Talent item right after Export when reports absent", () => {
    const labels = itemLabels(withTalentReportsNav(buildNavConfig("p1"), "p1"))
    const exportIdx = labels.indexOf("Export")
    expect(exportIdx).toBeGreaterThanOrEqual(0)
    expect(labels[exportIdx + 1]).toBe("Talent Reports")
  })

  it("points the item at the project-scoped talent-reports route", () => {
    const next = withTalentReportsNav(buildNavConfig("p1"), "p1")
    const item = next.entries.find((e) => e.type === "item" && e.item.label === "Talent Reports")
    expect(item && item.type === "item" ? item.item.to : null).toBe(
      "/projects/p1/export/talent-reports",
    )
  })

  it("appends Talent when no Export entry exists (fallback)", () => {
    const stub: NavConfig = {
      variant: "project",
      entries: [{ type: "item", item: { label: "Shots", to: "/projects/p1/shots", iconName: "camera" } }],
    }
    const next = withTalentReportsNav(stub, "p1")
    const last = next.entries[next.entries.length - 1]
    expect(last && last.type === "item" ? last.item.label : null).toBe("Talent Reports")
  })

  it("does not mutate the input config", () => {
    const base = buildNavConfig("p1")
    const beforeLen = base.entries.length
    withTalentReportsNav(base, "p1")
    expect(base.entries.length).toBe(beforeLen)
    expect(
      base.entries.some((e) => e.type === "item" && e.item.label === "Talent"),
    ).toBe(false)
  })
})
