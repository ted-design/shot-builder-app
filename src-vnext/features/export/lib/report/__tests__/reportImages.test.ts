import { describe, it, expect } from "vitest"
import { collectReportImageCandidates } from "../reportImages"
import type { ReportModel, ReportShot } from "../reportTypes"

// collectReportImageCandidates walks the resolved model for every image
// candidate. WS-C (2026-08-11) adds two things to watch: `look.image` already
// carries the hero-first cover value (resolveLooks in reportModel.ts), so no
// separate hero-candidate walk is needed here; and `shot.additionalImages` is
// a NEW per-shot field that must be collected too.

function shot(over: Partial<ReportShot> & { id: string }): ReportShot {
  return {
    number: "01",
    title: "Shot",
    colorway: null,
    status: "todo",
    gender: "?",
    notes: null,
    talent: [],
    looks: [],
    excluded: false,
    hasImage: false,
    ...over,
  }
}

function model(shots: readonly ReportShot[]): ReportModel {
  return {
    project: { name: "P", client: "c", shotCount: shots.length, dateRange: null },
    groups: [{ key: "all", label: "All shots", count: shots.length, shots }],
    order: { sortBy: "shot-number", sortDir: "asc" },
  }
}

describe("collectReportImageCandidates", () => {
  it("collects the primary look's image candidate, which is ALREADY hero-first (no separate hero walk needed)", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "hero-url", hasReference: false, products: [] }],
      }),
    ])
    expect(collectReportImageCandidates(m)).toEqual(["hero-url"])
  })

  it("collects every shot's additionalImages candidates (WS-C)", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1", "extra-2"],
      }),
    ])
    expect(collectReportImageCandidates(m)).toEqual(["cover-url", "extra-1", "extra-2"])
  })

  it("dedupes an additionalImages candidate that also appears elsewhere (talent headshot)", () => {
    // Talent headshots are collected before looks/additionalImages, so
    // "shared-url" appears once, at the position it was FIRST seen.
    const m = model([
      shot({
        id: "s1",
        talent: [{ id: "t1", name: "A", img: "shared-url" }],
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["shared-url", "extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m)).toEqual(["shared-url", "cover-url", "extra-1"])
  })

  it("a shot with additionalImages absent (pre-WS-C hand-built fixture) is treated as empty — no crash", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: null, hasReference: false, products: [] }],
      }),
    ])
    expect(() => collectReportImageCandidates(m)).not.toThrow()
    expect(collectReportImageCandidates(m)).toEqual([])
  })

  it("still collects product images and talent headshots alongside additionalImages (no regression)", () => {
    const m = model([
      shot({
        id: "s1",
        talent: [{ id: "t1", name: "A", img: "headshot-url" }],
        looks: [
          {
            id: "l0",
            label: "Primary",
            isAlt: false,
            image: "cover-url",
            hasReference: true,
            products: [
              { family: "Crew", style: null, colour: null, size: null, sizeScope: null, qty: 1, gender: "?", isHero: true, img: "prod-img" },
            ],
          },
        ],
        additionalImages: ["extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m)).toEqual(["headshot-url", "cover-url", "prod-img", "extra-1"])
  })

  it("empty model returns an empty candidate list", () => {
    expect(collectReportImageCandidates(model([]))).toEqual([])
  })
})
