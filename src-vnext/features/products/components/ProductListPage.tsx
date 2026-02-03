import { useState, useMemo } from "react"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { ProductFamilyCard } from "@/features/products/components/ProductFamilyCard"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Package, Search } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export default function ProductListPage() {
  const { data: families, loading, error } = useProductFamilies()
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const f of families) {
      if (f.category) cats.add(f.category)
    }
    return Array.from(cats).sort()
  }, [families])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return families.filter((f) => {
      if (activeCategory && f.category !== activeCategory) return false
      if (!q) return true
      return (
        f.styleName.toLowerCase().includes(q) ||
        (f.styleNumber?.toLowerCase().includes(q) ?? false) ||
        (f.category?.toLowerCase().includes(q) ?? false)
      )
    })
  }, [families, search, activeCategory])

  if (loading) return <LoadingState loading />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
        {error.isMissingIndex && error.indexUrl && (
          <a
            href={error.indexUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm text-[var(--color-primary)] underline"
          >
            Create required index
          </a>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Products" />
      <p className="-mt-3 text-sm text-[var(--color-text-muted)]">
        Browse your product catalog. Families and colorways from the org library.
      </p>

      {families.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No products yet"
          description="Products will appear here once they've been added to your organization's library."
        />
      ) : (
        <>
          {/* Search + filters */}
          <div className="flex flex-col gap-3">
            <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <Input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            {categories.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                <Badge
                  variant={activeCategory === null ? "default" : "outline"}
                  className={cn(
                    "cursor-pointer text-xs transition-colors",
                    activeCategory === null && "bg-[var(--color-primary)] text-[var(--color-primary-text)]",
                  )}
                  onClick={() => setActiveCategory(null)}
                >
                  All
                </Badge>
                {categories.map((cat) => (
                  <Badge
                    key={cat}
                    variant={activeCategory === cat ? "default" : "outline"}
                    className={cn(
                      "cursor-pointer text-xs transition-colors",
                      activeCategory === cat && "bg-[var(--color-primary)] text-[var(--color-primary-text)]",
                    )}
                    onClick={() =>
                      setActiveCategory(activeCategory === cat ? null : cat)
                    }
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No results"
              description={`No products match "${search}"${activeCategory ? ` in ${activeCategory}` : ""}. Try broadening your search.`}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((family) => (
                <ProductFamilyCard
                  key={family.id}
                  family={family}
                  skuCount={null}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
