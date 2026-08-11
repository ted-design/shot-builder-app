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

  it("defaults to including additionalImages when no options are passed (back-compat for hand-built-model callers)", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m)).toEqual(["cover-url", "extra-1"])
  })
})

// includeAdditionalImages (fix for: additionalImages fetched/transcoded even
// when showAdditionalImages is off) — the REAL caller, ShotReportPage, must
// pass the SAME effective value resolveShowAdditionalImages computes for
// rendering, so a report with the toggle off (the shipped default), on
// image-led (v1-excluded), or under a featureReportConfig rollback never pays
// the fetch+transcode cost for a row that can never be seen.
describe("collectReportImageCandidates — includeAdditionalImages gate", () => {
  it("includeAdditionalImages:false excludes shot.additionalImages from the candidate list entirely", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1", "extra-2"],
      }),
    ])
    expect(collectReportImageCandidates(m, { includeAdditionalImages: false })).toEqual(["cover-url"])
  })

  it("includeAdditionalImages:false still collects the cover, product, and talent candidates — only additionalImages is gated", () => {
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
    expect(collectReportImageCandidates(m, { includeAdditionalImages: false })).toEqual([
      "headshot-url",
      "cover-url",
      "prod-img",
    ])
  })

  it("includeAdditionalImages:true (explicit) behaves exactly like the pre-existing unconditional collection", () => {
    const m = model([
      shot({
        id: "s1",
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m, { includeAdditionalImages: true })).toEqual(["cover-url", "extra-1"])
  })
})

// Excluded shots (findings: additionalImages fetched even for shots the user
// excluded from the report — every recipe filters excluded shots out before
// render, so their additionalImages candidates can never be seen either way).
describe("collectReportImageCandidates — excluded shots", () => {
  it("an excluded shot's additionalImages are never collected, even with the gate on", () => {
    const m = model([
      shot({
        id: "s1",
        excluded: true,
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1", "extra-2"],
      }),
    ])
    expect(collectReportImageCandidates(m, { includeAdditionalImages: true })).toEqual(["cover-url"])
  })

  it("an excluded shot's cover/product/talent candidates are still collected (the on-screen fluid view shows them struck-through)", () => {
    const m = model([
      shot({
        id: "s1",
        excluded: true,
        talent: [{ id: "t1", name: "A", img: "headshot-url" }],
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m, { includeAdditionalImages: true })).toEqual(["headshot-url", "cover-url"])
  })

  it("a non-excluded shot's additionalImages are unaffected by a sibling excluded shot", () => {
    const m = model([
      shot({
        id: "s1",
        excluded: true,
        looks: [{ id: "l0", label: "Primary", isAlt: false, image: "excluded-cover", hasReference: true, products: [] }],
        additionalImages: ["excluded-extra"],
      }),
      shot({
        id: "s2",
        excluded: false,
        looks: [{ id: "l1", label: "Primary", isAlt: false, image: "cover-url", hasReference: true, products: [] }],
        additionalImages: ["extra-1"],
      }),
    ])
    expect(collectReportImageCandidates(m, { includeAdditionalImages: true })).toEqual([
      "excluded-cover",
      "cover-url",
      "extra-1",
    ])
  })
})
