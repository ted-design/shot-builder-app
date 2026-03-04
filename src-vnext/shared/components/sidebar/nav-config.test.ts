import { describe, it, expect } from "vitest"
import { buildNavConfig, getMobileNavConfig } from "./nav-config"

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
      expect(libraryItem.item.to).toBe("/library")
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
