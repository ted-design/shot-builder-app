// Product colorway strip — pure-text typographic centerpiece (read-only; writes stay in the right rail).
// Extracted from ShotDetailPageUnified (Phase 5e-I): the Shoot shell (5e-II)
// and the Review surface (5f) reuse it — this extraction is the 5e/5f
// presentational seam. Behavior-preserving: markup, classes, and testids are
// identical to the private original.
import { SectionLabel } from "@/features/shots/components/ShotDetailShared"
import type { ShotLook } from "@/shared/types"

export function ProductColorwayStrip({
  looks,
  activeLookId,
}: {
  readonly looks: ReadonlyArray<ShotLook>
  readonly activeLookId: string | null | undefined
}) {
  const sorted = [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const productCount = sorted.reduce((acc, l) => acc + (l.products?.length ?? 0), 0)
  const resolvedActiveId =
    activeLookId && sorted.some((l) => l.id === activeLookId)
      ? activeLookId
      : sorted.length > 0
        ? sorted[0]!.id
        : null

  return (
    <section
      className="border-t border-[var(--color-border)] pt-4"
      data-testid="product-colorway-strip"
    >
      <div className="flex items-baseline gap-2">
        <SectionLabel>Products</SectionLabel>
        {sorted.length > 0 && (
          <span className="text-2xs text-[var(--color-text-subtle)]">
            {productCount} {productCount === 1 ? "item" : "items"} &middot; {sorted.length}{" "}
            {sorted.length === 1 ? "look" : "looks"}
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
          No products yet. Add a look in the rail.
        </p>
      ) : (
        sorted.map((look) => {
          const products = look.products ?? []
          return (
            <div key={look.id} className="mt-3 first-of-type:mt-2">
              <p className="label-meta">
                {look.label || "Look"}
                {look.id === resolvedActiveId ? <> &middot; Active</> : null}
              </p>
              {products.length === 0 ? (
                <p className="py-1 text-sm text-[var(--color-text-muted)]">
                  No products in this look.
                </p>
              ) : (
                products.map((p, i) => (
                  <div
                    key={`${p.familyId}-${p.colourId ?? p.skuId ?? ""}-${i}`}
                    className="flex flex-wrap items-baseline gap-x-2.5 py-1"
                  >
                    <span className="text-base font-semibold text-[var(--color-text)]">
                      {p.familyName ?? p.familyId}
                    </span>
                    {(p.colourName || p.size) && (
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        {p.colourName && (
                          <>
                            &middot;{" "}
                            <span className="font-semibold text-[var(--color-text)]">
                              {p.colourName}
                            </span>
                          </>
                        )}
                        {p.size && <> &middot; {p.size}</>}
                      </span>
                    )}
                    {p.skuName && (
                      <span className="ml-auto text-2xs tabular-nums text-[var(--color-text-subtle)]">
                        {p.skuName}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
