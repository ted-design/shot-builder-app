import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { ProductFamilyCard } from "@/features/products/components/ProductFamilyCard"
import { ProductUpsertDialog } from "@/features/products/components/ProductUpsertDialog"
import { Input } from "@/ui/input"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Package, Plus, Search } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import {
  deriveProductCategories,
  filterAndSortProductFamilies,
  type ProductListSort,
  type ProductListStatusFilter,
} from "@/features/products/lib/productList"

export default function ProductListPage() {
  const { data: families, loading, error } = useProductFamilies()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageProducts(role)
  const [searchParams, setSearchParams] = useSearchParams()

  const qParam = searchParams.get("q") ?? ""
  const statusParam = (searchParams.get("status") ?? "all") as ProductListStatusFilter
  const catParam = searchParams.get("cat")
  const includeArchived = searchParams.get("arch") === "1"
  const includeDeleted = searchParams.get("del") === "1"
  const sortParam = (searchParams.get("sort") ?? "styleNameAsc") as ProductListSort

  const [searchDraft, setSearchDraft] = useState(qParam)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    setSearchDraft(qParam)
  }, [qParam])

  useEffect(() => {
    const next = searchDraft.trim()
    const handle = window.setTimeout(() => {
      setSearchParams((prev) => {
        const out = new URLSearchParams(prev)
        if (next) out.set("q", next)
        else out.delete("q")
        return out
      }, { replace: true })
    }, 250)
    return () => window.clearTimeout(handle)
  }, [searchDraft, setSearchParams])

  const categories = useMemo(() => deriveProductCategories(families), [families])

  const filtered = useMemo(() => {
    return filterAndSortProductFamilies(families, {
      query: qParam,
      status: statusParam,
      category: catParam && catParam.length > 0 ? catParam : null,
      includeArchived,
      includeDeleted,
      sort: sortParam,
    })
  }, [families, qParam, statusParam, catParam, includeArchived, includeDeleted, sortParam])

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
      <PageHeader
        title="Products"
        actions={
          canEdit ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New product
            </Button>
          ) : null
        }
      />
      <p className="-mt-3 text-sm text-[var(--color-text-muted)]">
        Browse your product catalog. Fast scanning, safe filters, no per-item loads.
      </p>

      {families.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="No products yet"
          description="Products will appear here once they've been added to your organization's library."
        />
      ) : (
        <>
          {/* Search + filters (URL-persisted) */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <Input
                placeholder="Search products..."
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                className="pl-9 text-sm"
              />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={statusParam}
                  onValueChange={(value) => {
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      if (value === "all") out.delete("status")
                      else out.set("status", value)
                      return out
                    }, { replace: true })
                  }}
                >
                  <SelectTrigger className="h-9 w-[150px] text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="discontinued">Discontinued</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={sortParam}
                  onValueChange={(value) => {
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      if (value === "styleNameAsc") out.delete("sort")
                      else out.set("sort", value)
                      return out
                    }, { replace: true })
                  }}
                >
                  <SelectTrigger className="h-9 w-[190px] text-sm">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="styleNameAsc">Style name (A→Z)</SelectItem>
                    <SelectItem value="styleNameDesc">Style name (Z→A)</SelectItem>
                    <SelectItem value="styleNumberAsc">Style # (low→high)</SelectItem>
                    <SelectItem value="styleNumberDesc">Style # (high→low)</SelectItem>
                    <SelectItem value="updatedDesc">Last updated</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-2 py-1">
                  <Checkbox
                    id="arch"
                    checked={includeArchived}
                    onCheckedChange={(checked) => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        if (checked) out.set("arch", "1")
                        else out.delete("arch")
                        return out
                      }, { replace: true })
                    }}
                  />
                  <label htmlFor="arch" className="text-xs text-[var(--color-text-muted)]">
                    Include archived
                  </label>
                </div>
              </div>
            </div>

            {(categories.length > 1 || catParam || includeDeleted) && (
              <div className="flex flex-wrap items-center gap-2">
                {categories.length > 1 && (
                  <Select
                    value={catParam ?? "all"}
                    onValueChange={(value) => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        if (value === "all") out.delete("cat")
                        else out.set("cat", value)
                        return out
                      }, { replace: true })
                    }}
                  >
                    <SelectTrigger className="h-9 w-[200px] text-sm">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-[var(--color-text-muted)]"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      if (includeDeleted) out.delete("del")
                      else out.set("del", "1")
                      return out
                    }, { replace: true })
                  }}
                >
                  {includeDeleted ? "Hide deleted" : "Show deleted"}
                </Button>

                {(qParam || statusParam !== "all" || catParam || includeArchived || includeDeleted || sortParam !== "styleNameAsc") && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-9 px-2 text-xs text-[var(--color-text-muted)]"
                    onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                  >
                    Clear filters
                  </Button>
                )}

                <span className="text-xs text-[var(--color-text-subtle)]">
                  Showing {filtered.length} of {families.length}
                </span>
              </div>
            )}
          </div>

          {/* Grid */}
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No results"
              description={`No products match "${qParam || searchDraft}"${catParam ? ` in ${catParam}` : ""}. Try broadening your search.`}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((family) => (
                <ProductFamilyCard
                  key={family.id}
                  family={family}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ProductUpsertDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
    </div>
  )
}
