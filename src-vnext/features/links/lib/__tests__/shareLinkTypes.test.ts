import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  computeShareLinkStatus,
  mapShotShareDoc,
  mapCastingShareDoc,
  mapPullToShareLink,
} from "../shareLinkTypes"

// ---------------------------------------------------------------------------
// computeShareLinkStatus
// ---------------------------------------------------------------------------

describe("computeShareLinkStatus", () => {
  it("returns disabled when enabled is false regardless of expiry", () => {
    expect(computeShareLinkStatus(false, null)).toBe("disabled")
    expect(computeShareLinkStatus(false, new Date(Date.now() + 9_999_999))).toBe("disabled")
    expect(computeShareLinkStatus(false, new Date(Date.now() - 9_999_999))).toBe("disabled")
  })

  it("returns expired when enabled and expiry is in the past", () => {
    const past = new Date(Date.now() - 1_000)
    expect(computeShareLinkStatus(true, past)).toBe("expired")
  })

  it("returns active when enabled and no expiry", () => {
    expect(computeShareLinkStatus(true, null)).toBe("active")
  })

  it("returns active when enabled and expiry is in the future", () => {
    const future = new Date(Date.now() + 86_400_000)
    expect(computeShareLinkStatus(true, future)).toBe("active")
  })
})

// ---------------------------------------------------------------------------
// mapPullToShareLink
// ---------------------------------------------------------------------------

describe("mapPullToShareLink", () => {
  it("returns null when shareToken is absent", () => {
    const result = mapPullToShareLink("pull-1", {
      shareEnabled: true,
      title: "My Pull",
    })
    expect(result).toBeNull()
  })

  it("returns null when shareToken is not a string", () => {
    const result = mapPullToShareLink("pull-1", {
      shareToken: 123,
      shareEnabled: true,
    })
    expect(result).toBeNull()
  })

  it("returns a ShareLink for a disabled pull (shareEnabled false)", () => {
    const result = mapPullToShareLink("pull-doc-1", {
      shareToken: "token-abc",
      shareEnabled: false,
      title: "Spring Pull",
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result).not.toBeNull()
    expect(result!.id).toBe("token-abc")
    expect(result!.type).toBe("pull")
    expect(result!.status).toBe("disabled")
    expect(result!.enabled).toBe(false)
    expect(result!.title).toBe("Spring Pull")
    expect(result!.sourceDocId).toBe("pull-doc-1")
    expect(result!.url).toBe("/pulls/shared/token-abc")
  })

  it("returns a ShareLink for an enabled pull", () => {
    const result = mapPullToShareLink("pull-doc-2", {
      shareToken: "token-xyz",
      shareEnabled: true,
      title: "Fall Pull",
      projectId: "proj-2",
      clientId: "client-2",
    })

    expect(result).not.toBeNull()
    expect(result!.status).toBe("active")
    expect(result!.enabled).toBe(true)
  })

  it("falls back to name field when title is absent", () => {
    const result = mapPullToShareLink("pull-doc-3", {
      shareToken: "token-name",
      shareEnabled: true,
      name: "Named Pull",
    })

    expect(result!.title).toBe("Named Pull")
  })

  it("falls back to Pull Share when neither title nor name is present", () => {
    const result = mapPullToShareLink("pull-doc-4", {
      shareToken: "token-fallback",
      shareEnabled: true,
    })

    expect(result!.title).toBe("Pull Share")
  })

  it("extracts contentCount from items array", () => {
    const result = mapPullToShareLink("pull-doc-5", {
      shareToken: "token-items",
      shareEnabled: true,
      items: [
        { familyName: "Jacket", colourName: "Black" },
        { familyName: "Pants", colourName: "Blue" },
        { styleNumber: "JK-001" },
      ],
    })

    expect(result!.contentCount).toBe(3)
    expect(result!.contentItems).toHaveLength(3)
    expect(result!.contentItems![0]).toEqual({ label: "Jacket", sublabel: "Black" })
    expect(result!.contentItems![1]).toEqual({ label: "Pants", sublabel: "Blue" })
    expect(result!.contentItems![2]).toEqual({ label: "JK-001", sublabel: undefined })
  })

  it("caps contentItems at 10 even when more items exist", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      familyName: `Item ${i + 1}`,
    }))

    const result = mapPullToShareLink("pull-doc-6", {
      shareToken: "token-cap",
      shareEnabled: true,
      items,
    })

    expect(result!.contentCount).toBe(15)
    expect(result!.contentItems).toHaveLength(10)
  })

  it("sets contentCount to null when items field is absent", () => {
    const result = mapPullToShareLink("pull-doc-7", {
      shareToken: "token-no-items",
      shareEnabled: true,
    })

    expect(result!.contentCount).toBeNull()
    expect(result!.contentItems).toBeNull()
  })

  it("uses Item as label fallback when familyName and styleNumber are absent", () => {
    const result = mapPullToShareLink("pull-doc-8", {
      shareToken: "token-noname",
      shareEnabled: true,
      items: [{}],
    })

    const items = result!.contentItems!
    expect(items[0]!.label).toBe("Item")
  })
})

// ---------------------------------------------------------------------------
// mapShotShareDoc
// ---------------------------------------------------------------------------

describe("mapShotShareDoc", () => {
  it("extracts contentCount from resolvedShots array (preferred over shotIds)", () => {
    const result = mapShotShareDoc("share-1", {
      enabled: true,
      resolvedShots: [
        { shotNumber: "001", description: "Opening shot" },
        { shotNumber: "002", description: "Close-up" },
      ],
      shotIds: ["a", "b", "c"],
      projectId: "proj-1",
      clientId: "client-1",
    })

    // resolvedShots takes precedence
    expect(result.contentCount).toBe(2)
    expect(result.contentItems).toHaveLength(2)
    expect(result.contentItems![0]).toEqual({ label: "001", sublabel: "Opening shot" })
    expect(result.contentItems![1]).toEqual({ label: "002", sublabel: "Close-up" })
  })

  it("falls back to shotIds length when resolvedShots is absent", () => {
    const result = mapShotShareDoc("share-2", {
      enabled: true,
      shotIds: ["a", "b", "c"],
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.contentCount).toBe(3)
    expect(result.contentItems).toBeNull()
  })

  it("sets contentCount to null when both resolvedShots and shotIds are absent", () => {
    const result = mapShotShareDoc("share-3", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.contentCount).toBeNull()
    expect(result.contentItems).toBeNull()
  })

  it("uses Shot as label when shotNumber is absent", () => {
    const result = mapShotShareDoc("share-4", {
      enabled: true,
      resolvedShots: [{ description: "Landscape" }],
      projectId: "proj-1",
      clientId: "client-1",
    })

    const items = result.contentItems!
    expect(items[0]!.label).toBe("Shot")
    expect(items[0]!.sublabel).toBe("Landscape")
  })

  it("omits sublabel when description is absent", () => {
    const result = mapShotShareDoc("share-5", {
      enabled: true,
      resolvedShots: [{ shotNumber: "003" }],
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.contentItems![0]!.sublabel).toBeUndefined()
  })

  it("sets status to disabled when enabled is false", () => {
    const result = mapShotShareDoc("share-6", {
      enabled: false,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.status).toBe("disabled")
  })

  it("falls back to Shot Share when title is absent", () => {
    const result = mapShotShareDoc("share-7", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.title).toBe("Shot Share")
  })
})

// ---------------------------------------------------------------------------
// mapCastingShareDoc
// ---------------------------------------------------------------------------

describe("mapCastingShareDoc", () => {
  it("sets vote count as engagement", () => {
    const result = mapCastingShareDoc(
      "cast-1",
      {
        enabled: true,
        projectId: "proj-1",
        clientId: "client-1",
      },
      7,
    )

    expect(result.engagement).toBe(7)
  })

  it("sets engagement to null when voteCount is not provided", () => {
    const result = mapCastingShareDoc("cast-2", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.engagement).toBeNull()
  })

  it("extracts contentCount from resolvedTalent", () => {
    const result = mapCastingShareDoc(
      "cast-3",
      {
        enabled: true,
        resolvedTalent: [
          { name: "Alice", agency: "IMG" },
          { name: "Bob", agency: "Next" },
          { name: "Charlie" },
        ],
        projectId: "proj-1",
        clientId: "client-1",
      },
      4,
    )

    expect(result.contentCount).toBe(3)
    expect(result.contentItems).toHaveLength(3)
    expect(result.contentItems![0]).toEqual({ label: "Alice", sublabel: "IMG" })
    expect(result.contentItems![1]).toEqual({ label: "Bob", sublabel: "Next" })
    expect(result.contentItems![2]).toEqual({ label: "Charlie", sublabel: undefined })
  })

  it("sets contentCount to null when resolvedTalent is absent", () => {
    const result = mapCastingShareDoc("cast-4", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.contentCount).toBeNull()
    expect(result.contentItems).toBeNull()
  })

  it("caps contentItems at 10", () => {
    const talent = Array.from({ length: 12 }, (_, i) => ({ name: `Model ${i + 1}` }))

    const result = mapCastingShareDoc("cast-5", {
      enabled: true,
      resolvedTalent: talent,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.contentCount).toBe(12)
    expect(result.contentItems).toHaveLength(10)
  })

  it("uses Talent as label when name is absent", () => {
    const result = mapCastingShareDoc("cast-6", {
      enabled: true,
      resolvedTalent: [{ agency: "Ford" }],
      projectId: "proj-1",
      clientId: "client-1",
    })

    const items = result.contentItems!
    expect(items[0]!.label).toBe("Talent")
    expect(items[0]!.sublabel).toBe("Ford")
  })

  it("falls back to Casting Share when title is absent", () => {
    const result = mapCastingShareDoc("cast-7", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.title).toBe("Casting Share")
  })

  it("sets type to casting", () => {
    const result = mapCastingShareDoc("cast-8", {
      enabled: true,
      projectId: "proj-1",
      clientId: "client-1",
    })

    expect(result.type).toBe("casting")
  })
})
