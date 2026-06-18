/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { ProductAssignment, Shot } from "@/shared/types"

const { updateShotWithVersionMock } = vi.hoisted(() => ({
  updateShotWithVersionMock: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer", clientId: "c1", user: { uid: "u1" } }),
}))

// Stub picker that surfaces the hero-toggle wiring so we can drive handleToggleHero.
vi.mock("@/features/shots/components/ProductAssignmentPicker", () => ({
  ProductAssignmentPicker: ({
    selected,
    heroIndexes,
    onToggleHero,
    onSave,
  }: {
    selected: ReadonlyArray<ProductAssignment>
    heroIndexes?: ReadonlySet<number>
    onToggleHero?: (index: number) => void
    onSave: (products: ProductAssignment[]) => Promise<boolean>
  }) => (
    <div>
      Product picker
      {selected.map((p, i) => (
        <button
          key={i}
          data-testid={`toggle-hero-${i}`}
          data-hero={heroIndexes?.has(i) ? "1" : "0"}
          onClick={() => onToggleHero?.(i)}
        >
          {p.familyId}
        </button>
      ))}
      <button
        data-testid="remove-product-0"
        onClick={() => void onSave(selected.slice(1))}
      >
        remove first
      </button>
    </div>
  ),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => null,
}))

vi.mock("@/shared/lib/uploadImage", () => ({
  uploadShotReferenceImage: vi.fn(),
  validateImageFileForUpload: vi.fn(),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: updateShotWithVersionMock,
}))

import { ShotLooksSection } from "@/features/shots/components/ShotLooksSection"

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    looks: overrides.looks,
    activeLookId: overrides.activeLookId,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

type WrittenLook = { products: ProductAssignment[]; heroProductId?: string | null }

function lastSavedLooks(): WrittenLook[] {
  const calls = updateShotWithVersionMock.mock.calls
  const last = calls[calls.length - 1]?.[0] as { patch: { looks: WrittenLook[] } }
  return last.patch.looks
}

describe("ShotLooksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateShotWithVersionMock.mockResolvedValue(undefined)
  })

  it("renders the look section with the hero-star caption (no cover dropdown)", () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [{ familyId: "fam-1", familyName: "Classic Tee", sizeScope: "pending" }],
          heroProductId: null,
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)

    expect(screen.getByText("Product picker")).toBeInTheDocument()
    expect(screen.getByText(/Star hero product/i)).toBeInTheDocument()
    expect(screen.queryByText("Cover product (optional)")).not.toBeInTheDocument()
  })

  it("stars a product: persists explicit isHero and syncs heroProductId to the first star", async () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [
            { familyId: "fam-a", skuId: "sku-a", sizeScope: "pending" },
            { familyId: "fam-b", skuId: "sku-b", sizeScope: "pending" },
          ],
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)
    fireEvent.click(screen.getByTestId("toggle-hero-1"))

    await waitFor(() => expect(updateShotWithVersionMock).toHaveBeenCalled())
    const products = lastSavedLooks()[0]!.products
    expect(products[0]!.isHero).toBeUndefined()
    expect(products[1]!.isHero).toBe(true)
    // heroProductId (the cover pointer) follows the first starred product.
    expect(lastSavedLooks()[0]!.heroProductId).toBe("sku-b")
  })

  it("clearing the only star drops heroProductId to AUTO (undefined, not null)", async () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [{ familyId: "fam-a", skuId: "sku-a", isHero: true, sizeScope: "pending" }],
          heroProductId: "sku-a",
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)
    fireEvent.click(screen.getByTestId("toggle-hero-0"))

    await waitFor(() => expect(updateShotWithVersionMock).toHaveBeenCalled())
    expect(lastSavedLooks()[0]!.products[0]!.isHero).toBeUndefined()
    // undefined → sanitizer omits the key → AUTO cover (first-product fallback), not NONE.
    expect(lastSavedLooks()[0]!.heroProductId).toBeUndefined()
  })

  it("re-syncs heroProductId when a starred product is removed via the picker (no dangling cover)", async () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [
            { familyId: "fam-a", skuId: "sku-a", isHero: true, sizeScope: "pending" },
            { familyId: "fam-b", skuId: "sku-b", sizeScope: "pending" },
          ],
          heroProductId: "sku-a",
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)
    // Removing the starred product A (via the picker onSave path) must not leave
    // heroProductId pointing at the absent A — it should fall back to AUTO.
    fireEvent.click(screen.getByTestId("remove-product-0"))

    await waitFor(() => expect(updateShotWithVersionMock).toHaveBeenCalled())
    const look = lastSavedLooks()[0]!
    expect(look.products.map((p) => p.familyId)).toEqual(["fam-b"])
    expect(look.heroProductId).toBeUndefined()
  })

  it("non-destructively migrates a legacy heroProductId when a second product is starred", async () => {
    const shot = makeShot({
      looks: [
        {
          id: "look-1",
          order: 0,
          label: "Primary",
          products: [
            { familyId: "fam-a", skuId: "sku-a", sizeScope: "pending" },
            { familyId: "fam-b", skuId: "sku-b", sizeScope: "pending" },
          ],
          // Legacy single cover points at product B; neither product has isHero yet.
          heroProductId: "sku-b",
          references: [],
          displayImageId: null,
        },
      ],
    })

    render(<ShotLooksSection shot={shot} canEdit />)
    // The legacy hero (B, index 1) should already render as starred.
    expect(screen.getByTestId("toggle-hero-1").getAttribute("data-hero")).toBe("1")
    expect(screen.getByTestId("toggle-hero-0").getAttribute("data-hero")).toBe("0")

    // Star A too — the legacy hero must be preserved, not overwritten.
    fireEvent.click(screen.getByTestId("toggle-hero-0"))

    await waitFor(() => expect(updateShotWithVersionMock).toHaveBeenCalled())
    const products = lastSavedLooks()[0]!.products
    expect(products[0]!.isHero).toBe(true)
    expect(products[1]!.isHero).toBe(true)
    // First star in array order is A → cover pointer follows it.
    expect(lastSavedLooks()[0]!.heroProductId).toBe("sku-a")
  })
})
