export type ProductListViewMode = "gallery" | "table"

export type ProductTableColumnKey =
  | "preview"
  | "styleNumber"
  | "category"
  | "colorways"
  | "status"
  | "updatedAt"

export type ProductTableColumnVisibility = Record<ProductTableColumnKey, boolean>

export type ProductCardPropertyKey = "styleNumber" | "category" | "status"

export type ProductCardPropertyVisibility = Record<ProductCardPropertyKey, boolean>

const VIEW_STORAGE_KEY = "vnext:products:viewMode"
const COLUMNS_STORAGE_KEY = "vnext:products:tableColumns"
const CARD_PROPERTIES_STORAGE_KEY = "vnext:products:cardProperties"

const DEFAULT_COLUMNS: ProductTableColumnVisibility = {
  preview: true,
  styleNumber: true,
  category: true,
  colorways: true,
  status: true,
  updatedAt: true,
}

const DEFAULT_CARD_PROPERTIES: ProductCardPropertyVisibility = {
  styleNumber: true,
  category: true,
  status: true,
}

export function readProductListViewMode(): ProductListViewMode {
  if (typeof window === "undefined") return "gallery"
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored === "gallery" || stored === "table") return stored
  } catch {
    // localStorage unavailable
  }
  return "gallery"
}

export function writeProductListViewMode(next: ProductListViewMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, next)
  } catch {
    // localStorage unavailable
  }
}

export function readProductTableColumns(): ProductTableColumnVisibility {
  if (typeof window === "undefined") return { ...DEFAULT_COLUMNS }
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_COLUMNS }
    const parsed = JSON.parse(stored) as Partial<ProductTableColumnVisibility>
    return { ...DEFAULT_COLUMNS, ...parsed }
  } catch {
    // localStorage unavailable / invalid JSON
  }
  return { ...DEFAULT_COLUMNS }
}

export function writeProductTableColumns(next: ProductTableColumnVisibility): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable
  }
}

export function defaultProductTableColumns(): ProductTableColumnVisibility {
  return { ...DEFAULT_COLUMNS }
}

export function readProductCardProperties(): ProductCardPropertyVisibility {
  if (typeof window === "undefined") return { ...DEFAULT_CARD_PROPERTIES }
  try {
    const stored = localStorage.getItem(CARD_PROPERTIES_STORAGE_KEY)
    if (!stored) return { ...DEFAULT_CARD_PROPERTIES }
    const parsed = JSON.parse(stored) as Partial<ProductCardPropertyVisibility>
    return { ...DEFAULT_CARD_PROPERTIES, ...parsed }
  } catch {
    // localStorage unavailable / invalid JSON
  }
  return { ...DEFAULT_CARD_PROPERTIES }
}

export function writeProductCardProperties(next: ProductCardPropertyVisibility): void {
  try {
    localStorage.setItem(CARD_PROPERTIES_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // localStorage unavailable
  }
}

export function defaultProductCardProperties(): ProductCardPropertyVisibility {
  return { ...DEFAULT_CARD_PROPERTIES }
}
