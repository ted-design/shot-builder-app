import { useEffect, useState } from "react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import type { ProductAssignment, ShotLook } from "@/shared/types"

function ThumbCircle({ src, alt }: { readonly src: string | undefined; readonly alt: string }) {
  const resolved = useStorageUrl(src)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!resolved || errored) {
    return (
      <div
        className="h-10 w-10 shrink-0 rounded-full bg-[var(--color-surface-subtle)] border border-[var(--color-border)] flex items-center justify-center"
        title={alt}
      >
        <span className="text-2xs text-[var(--color-text-subtle)] leading-none">
          {alt.charAt(0).toUpperCase()}
        </span>
      </div>
    )
  }

  return (
    <img
      src={resolved}
      alt={alt}
      title={alt}
      className="h-10 w-10 shrink-0 rounded-full border border-[var(--color-border)] object-cover"
      onError={() => setErrored(true)}
    />
  )
}

function collectAllProducts(looks: ReadonlyArray<ShotLook>): ProductAssignment[] {
  const seen = new Set<string>()
  const result: ProductAssignment[] = []
  for (const look of looks) {
    for (const p of look.products ?? []) {
      const key = `${p.familyId}:${p.colourId ?? p.skuId ?? ""}`
      if (!seen.has(key)) {
        seen.add(key)
        result.push(p)
      }
    }
  }
  return result
}

export function ProductSummaryStrip({
  looks,
}: {
  readonly looks: ReadonlyArray<ShotLook>
}) {
  const allProducts = collectAllProducts(looks)
  const lookCount = looks.length

  if (allProducts.length === 0) return null

  const productCount = allProducts.length
  const summaryText =
    lookCount > 1
      ? `${productCount} ${productCount === 1 ? "product" : "products"} across ${lookCount} looks`
      : `${productCount} ${productCount === 1 ? "product" : "products"}`

  return (
    <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {allProducts.map((p, i) => {
          const name = p.familyName ?? p.familyId
          const thumbSrc = p.thumbUrl ?? p.skuImageUrl ?? p.familyImageUrl
          return (
            <div key={`${p.familyId}-${p.colourId ?? p.skuId ?? ""}-${i}`} className="flex flex-col items-center gap-1">
              <ThumbCircle src={thumbSrc} alt={name} />
              <span className="max-w-[60px] text-center text-2xs text-[var(--color-text-subtle)] leading-tight truncate" title={name}>
                {name}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-2xs text-[var(--color-text-subtle)]">{summaryText}</p>
    </div>
  )
}
