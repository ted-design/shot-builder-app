import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { ProductFamilyCard } from "@/features/products/components/ProductFamilyCard"
import { ProductFamiliesTable } from "@/features/products/components/ProductFamiliesTable"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { LayoutGrid, Package, Plus, Search, SlidersHorizontal, Table, X } from "lucide-react"
import {
  deriveProductScaffoldOptions,
  filterAndSortProductFamilies,
  type ProductListSort,
  type ProductListStatusFilter,
} from "@/features/products/lib/productList"
import {
  defaultProductTableColumns,
  defaultProductCardProperties,
  readProductListViewMode,
  readProductCardProperties,
  readProductTableColumns,
  writeProductListViewMode,
  writeProductCardProperties,
  writeProductTableColumns,
  type ProductCardPropertyKey,
  type ProductListViewMode,
  type ProductTableColumnKey,
} from "@/features/products/lib/productPreferences"

const COLUMN_LABELS: Record<ProductTableColumnKey, string> = {
  preview: "Preview",
  styleNumber: "Style #",
  category: "Category",
  colorways: "Colorways",
  status: "Status",
  updatedAt: "Updated",
}

const CARD_PROPERTY_LABELS: Record<ProductCardPropertyKey, string> = {
  styleNumber: "Style #",
  category: "Category",
  status: "Status badges",
}

export default function ProductListPage() {
  const { data: families, loading, error } = useProductFamilies()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const canCreate = canManageProducts(role)
  const canEdit = !isMobile && canCreate
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const navigateToCreate = () => {
    const returnTo = `${location.pathname}${location.search}`
    const encoded = encodeURIComponent(returnTo)
    navigate(`/products/new?returnTo=${encoded}&productsReturnTo=${encoded}`)
  }

  useKeyboardShortcuts([
    { key: "c", handler: () => { if (canCreate) navigateToCreate() } },
  ])

  const qParam = searchParams.get("q") ?? ""
  const statusParam = (searchParams.get("status") ?? "all") as ProductListStatusFilter
  const genderParam = searchParams.get("gender")
  const typeParam = searchParams.get("type")
  const subParam = searchParams.get("sub") ?? searchParams.get("cat")
  const includeArchived = searchParams.get("arch") === "1"
  const includeDeleted = searchParams.get("del") === "1"
  const sortParam = (searchParams.get("sort") ?? "styleNameAsc") as ProductListSort
  const viewParam = searchParams.get("view")

  const [searchDraft, setSearchDraft] = useState(qParam)
  const [tableColumns, setTableColumns] = useState(() => readProductTableColumns())
  const [cardProperties, setCardProperties] = useState(() => readProductCardProperties())

  useEffect(() => {
    setSearchDraft(qParam)
  }, [qParam])

  useEffect(() => {
    writeProductTableColumns(tableColumns)
  }, [tableColumns])

  useEffect(() => {
    writeProductCardProperties(cardProperties)
  }, [cardProperties])

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

  const scaffold = useMemo(() => deriveProductScaffoldOptions(families), [families])

  const viewMode: ProductListViewMode = useMemo(() => {
    if (isMobile) return "gallery"
    if (viewParam === "gallery" || viewParam === "table") return viewParam
    return readProductListViewMode()
  }, [isMobile, viewParam])

  const genderKey = useMemo(() => {
    if (!genderParam) return null
    return scaffold.genders.some((g) => g.key === genderParam) ? genderParam : null
  }, [genderParam, scaffold.genders])

  const typeKey = useMemo(() => {
    if (!genderKey) return null
    if (!typeParam) return null
    const options = scaffold.typesByGender[genderKey] ?? []
    return options.some((t) => t.key === typeParam) ? typeParam : null
  }, [genderKey, typeParam, scaffold.typesByGender])

  const subKey = useMemo(() => {
    if (!genderKey || !typeKey) return null
    if (!subParam) return null
    const options = scaffold.subcategoriesByGenderAndType[genderKey]?.[typeKey] ?? []
    return options.some((s) => s.key === subParam) ? subParam : null
  }, [genderKey, typeKey, subParam, scaffold.subcategoriesByGenderAndType])

  const orderedGenders = useMemo(() => {
    const rank: Record<string, number> = { men: 0, women: 1, unisex: 2 }
    return [...scaffold.genders].sort((a, b) => {
      const left = rank[a.key] ?? 99
      const right = rank[b.key] ?? 99
      if (left !== right) return left - right
      return a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
    })
  }, [scaffold.genders])

  const filtered = useMemo(() => {
    return filterAndSortProductFamilies(families, {
      query: qParam,
      status: statusParam,
      gender: genderKey,
      productType: typeKey,
      productSubcategory: subKey,
      category: subParam && subParam.length > 0 ? subParam : null,
      includeArchived,
      includeDeleted,
      sort: sortParam,
    })
  }, [families, qParam, statusParam, genderKey, typeKey, subKey, subParam, includeArchived, includeDeleted, sortParam])

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

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
    <ErrorBoundary>
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Products"
        actions={
          <div className="flex items-center gap-2">
            {!isMobile && (
              <div className="flex items-center rounded-md border border-input bg-background p-1">
                <Button
                  type="button"
                  variant={viewMode === "gallery" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    writeProductListViewMode("gallery")
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      out.set("view", "gallery")
                      return out
                    }, { replace: true })
                  }}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    writeProductListViewMode("table")
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      out.set("view", "table")
                      return out
                    }, { replace: true })
                  }}
                >
                  <Table className="h-4 w-4" />
                </Button>
              </div>
            )}

            {canCreate && (
              isMobile ? (
                <Button size="icon" aria-label="New product" onClick={navigateToCreate}>
                  <Plus className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={navigateToCreate}>
                  <Plus className="h-4 w-4" />
                  New product
                </Button>
              )
            )}
          </div>
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
                  value={genderKey ?? "all"}
                  onValueChange={(value) => {
                    setSearchParams((prev) => {
                      const out = new URLSearchParams(prev)
                      out.delete("type")
                      out.delete("sub")
                      out.delete("cat")
                      if (value === "all") out.delete("gender")
                      else out.set("gender", value)
                      return out
                    }, { replace: true })
                  }}
                >
                  <SelectTrigger className="h-9 w-[150px] text-sm">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All genders</SelectItem>
                    {orderedGenders.map((g) => (
                      <SelectItem key={g.key} value={g.key}>
                        {g.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {genderKey && (
                  <Select
                    value={typeKey ?? "all"}
                    onValueChange={(value) => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("sub")
                        out.delete("cat")
                        if (value === "all") out.delete("type")
                        else out.set("type", value)
                        return out
                      }, { replace: true })
                    }}
                  >
                    <SelectTrigger className="h-9 w-[160px] text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {(scaffold.typesByGender[genderKey] ?? []).map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {genderKey && typeKey && (
                  <Select
                    value={subKey ?? "all"}
                    onValueChange={(value) => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("cat")
                        if (value === "all") out.delete("sub")
                        else out.set("sub", value)
                        return out
                      }, { replace: true })
                    }}
                  >
                    <SelectTrigger className="h-9 w-[170px] text-sm">
                      <SelectValue placeholder="Subcategory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All subcategories</SelectItem>
                      {(scaffold.subcategoriesByGenderAndType[genderKey]?.[typeKey] ?? []).map((s) => (
                        <SelectItem key={s.key} value={s.key}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

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

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-9">
                      <SlidersHorizontal className="h-4 w-4" />
                      View options
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Filters</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
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
                      <DropdownMenuRadioItem value="all">All statuses</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="active">Active only</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="discontinued">Discontinued only</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={includeArchived}
                      onCheckedChange={(checked) => {
                        setSearchParams((prev) => {
                          const out = new URLSearchParams(prev)
                          if (checked) out.set("arch", "1")
                          else out.delete("arch")
                          return out
                        }, { replace: true })
                      }}
                    >
                      Include archived
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                      checked={includeDeleted}
                      onCheckedChange={(checked) => {
                        setSearchParams((prev) => {
                          const out = new URLSearchParams(prev)
                          if (checked) out.set("del", "1")
                          else out.delete("del")
                          return out
                        }, { replace: true })
                      }}
                    >
                      Show deleted
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    {viewMode === "table" && !isMobile ? (
                      <>
                        <DropdownMenuLabel>Property visibility</DropdownMenuLabel>
                        {(Object.keys(COLUMN_LABELS) as ProductTableColumnKey[]).map((key) => (
                          <DropdownMenuCheckboxItem
                            key={key}
                            checked={tableColumns[key]}
                            onCheckedChange={(checked) =>
                              setTableColumns((prev) => ({
                                ...prev,
                                [key]: Boolean(checked),
                              }))
                            }
                          >
                            {COLUMN_LABELS[key]}
                          </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs"
                          onSelect={(e) => {
                            e.preventDefault()
                            setTableColumns(defaultProductTableColumns())
                          }}
                        >
                          Reset table properties
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuLabel>Property visibility</DropdownMenuLabel>
                        {(Object.keys(CARD_PROPERTY_LABELS) as ProductCardPropertyKey[]).map((key) => (
                          <DropdownMenuCheckboxItem
                            key={key}
                            checked={cardProperties[key]}
                            onCheckedChange={(checked) =>
                              setCardProperties((prev) => ({
                                ...prev,
                                [key]: Boolean(checked),
                              }))
                            }
                          >
                            {CARD_PROPERTY_LABELS[key]}
                          </DropdownMenuCheckboxItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-xs"
                          onSelect={(e) => {
                            e.preventDefault()
                            setCardProperties(defaultProductCardProperties())
                          }}
                        >
                          Reset card properties
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {(statusParam !== "all" ||
              genderKey ||
              typeKey ||
              subKey ||
              includeArchived ||
              includeDeleted ||
              sortParam !== "styleNameAsc") && (
              <div className="flex flex-wrap items-center gap-2">
                {statusParam !== "all" && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("status")
                        return out
                      }, { replace: true })
                    }}
                  >
                    Status: {statusParam === "discontinued" ? "Discontinued" : "Active"}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {genderKey && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("gender")
                        out.delete("type")
                        out.delete("sub")
                        out.delete("cat")
                        return out
                      }, { replace: true })
                    }}
                  >
                    {scaffold.genders.find((g) => g.key === genderKey)?.label ?? genderKey}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {typeKey && genderKey && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("type")
                        out.delete("sub")
                        out.delete("cat")
                        return out
                      }, { replace: true })
                    }}
                  >
                    {scaffold.typesByGender[genderKey]?.find((t) => t.key === typeKey)?.label ?? typeKey}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {subKey && genderKey && typeKey && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("sub")
                        out.delete("cat")
                        return out
                      }, { replace: true })
                    }}
                  >
                    {scaffold.subcategoriesByGenderAndType[genderKey]?.[typeKey]?.find((s) => s.key === subKey)?.label ?? subKey}
                    <X className="h-3 w-3" />
                  </button>
                )}
                {includeArchived && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("arch")
                        return out
                      }, { replace: true })
                    }}
                  >
                    Include archived
                    <X className="h-3 w-3" />
                  </button>
                )}
                {includeDeleted && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-xs text-[var(--color-text-muted)]"
                    onClick={() => {
                      setSearchParams((prev) => {
                        const out = new URLSearchParams(prev)
                        out.delete("del")
                        return out
                      }, { replace: true })
                    }}
                  >
                    Show deleted
                    <X className="h-3 w-3" />
                  </button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-xs text-[var(--color-text-muted)]"
                  onClick={() => setSearchParams(new URLSearchParams({ view: viewMode }), { replace: true })}
                >
                  Clear filters
                </Button>

                <span className="text-xs text-[var(--color-text-subtle)]">
                  Showing {filtered.length} of {families.length}
                </span>
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="h-8 w-8" />}
              title="No results"
              description={`No products match "${qParam || searchDraft}". Try broadening your search.`}
            />
          ) : viewMode === "table" ? (
            <ProductFamiliesTable families={filtered} columns={tableColumns} />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {filtered.map((family) => (
                <ProductFamilyCard
                  key={family.id}
                  family={family}
                  properties={cardProperties}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
    </ErrorBoundary>
  )
}
