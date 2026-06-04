import { useMemo } from "react"
import type { ProductAssignment, Shot } from "@/shared/types"
import { InlineEmpty } from "@/shared/components/InlineEmpty"

/**
 * ProductsInShoot — "Products in shoot" zone of the Status-Ledger project home
 * (mockup 01-A-ledger-desktop.html, right rail). Aggregates the DISTINCT product
 * families referenced across every shot's `products[]` and renders each as a chip
 * with its distinct colourway qualifiers. Read-only; no writes, no hooks here.
 *
 * Tokens only — `var(--color-*)` / `var(--font-*)`. Never hardcode hex.
 */

/** One aggregated product family, with the distinct colourways seen across shots. */
export interface AggregatedProduct {
  /** Stable key — familyId when present, else the normalized name. */
  readonly key: string
  /** Display name (familyName, falling back to skuName, then key). */
  readonly name: string
  /** Distinct colourway labels seen for this family (ordered by first appearance). */
  readonly colours: readonly string[]
  /** Number of shots that reference this family. */
  readonly shotCount: number
}

/**
 * Pure aggregator: collapse every `shot.products[]` ProductAssignment into a
 * deduped list of families. Distinct by `familyId` (or normalized name when the
 * id is absent). Colourways are collected per family, deduped, first-seen order.
 *
 * Exported for unit testing and reuse; takes already-fetched shots, no fetching.
 */
export function aggregateProducts(
  shots: ReadonlyArray<Shot>,
): readonly AggregatedProduct[] {
  const byKey = new Map<
    string,
    { name: string; colours: string[]; shots: Set<string> }
  >()

  for (const shot of shots) {
    // A shot may list the same family more than once (different colour/size);
    // only count the shot once per family for shotCount.
    const seenInShot = new Set<string>()

    for (const product of shot.products ?? []) {
      const key = resolveKey(product)
      if (!key) continue

      const name = resolveName(product, key)
      const existing = byKey.get(key)
      const entry = existing ?? { name, colours: [], shots: new Set<string>() }

      const colour = (product.colourName ?? "").trim()
      if (colour.length > 0 && !entry.colours.includes(colour)) {
        entry.colours.push(colour)
      }
      if (!seenInShot.has(key)) {
        entry.shots.add(shot.id)
        seenInShot.add(key)
      }
      // Prefer a non-key fallback name if a later assignment carries a real one.
      if (entry.name === key && name !== key) entry.name = name

      if (!existing) byKey.set(key, entry)
    }
  }

  return [...byKey.entries()].map(([key, v]) => ({
    key,
    name: v.name,
    colours: v.colours,
    shotCount: v.shots.size,
  }))
}

function resolveKey(product: ProductAssignment): string {
  const familyId = (product.familyId ?? "").trim()
  if (familyId.length > 0) return familyId
  const fallback = (product.familyName ?? product.skuName ?? "").trim()
  return fallback.toLowerCase()
}

function resolveName(product: ProductAssignment, key: string): string {
  return (product.familyName ?? product.skuName ?? "").trim() || key
}

export interface ProductsInShootProps {
  /** Already-fetched shots for the project (read-only). */
  readonly shots: ReadonlyArray<Shot>
}

/**
 * Renders the "Products in shoot" rail. Distinct families as chips; an
 * InlineEmpty when no shot references any product.
 */
/** How many products to show before collapsing into a "+N more" tail. */
const MAX_VISIBLE = 6

export function ProductsInShoot({ shots }: ProductsInShootProps) {
  const products = useMemo(() => aggregateProducts(shots), [shots])
  const visible = products.slice(0, MAX_VISIBLE)
  const overflow = products.length - visible.length

  return (
    <section aria-labelledby="products-in-shoot-heading">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3
          id="products-in-shoot-heading"
          className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]"
        >
          Products in shoot
        </h3>
        {products.length > 0 && (
          <span className="text-[10px] tabular-nums text-[var(--color-text-muted)]">
            {products.length}
          </span>
        )}
      </div>

      {products.length === 0 ? (
        <InlineEmpty
          title="No products yet"
          description="Products appear here once shots reference them."
        />
      ) : (
        <ul className="flex flex-col">
          {visible.map((product) => {
            const extraColours = product.colours.length - 1
            const qualifier =
              product.colours.length > 0
                ? extraColours > 0
                  ? `${product.colours[0]} +${extraColours}`
                  : product.colours[0]
                : `${product.shotCount} ${product.shotCount === 1 ? "shot" : "shots"}`
            return (
              <li
                key={product.key}
                className="flex items-baseline gap-3 border-b border-[var(--color-border)] py-[7px] text-xs last:border-b-0"
              >
                <span className="truncate font-medium text-[var(--color-text)]">
                  {product.name}
                </span>
                <span className="ml-auto max-w-[140px] truncate text-right text-[var(--color-text-secondary)] tabular-nums">
                  {qualifier}
                </span>
              </li>
            )
          })}
          {overflow > 0 && (
            <li className="py-[7px] text-xs text-[var(--color-text-muted)]">
              +{overflow} more {overflow === 1 ? "product" : "products"}
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
