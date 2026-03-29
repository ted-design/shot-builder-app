import { useState, useCallback } from "react"

export interface SelectedFamily {
  readonly familyId: string
  readonly familyName: string
}

export interface SelectedSku {
  readonly familyId: string
  readonly familyName: string
  readonly skuId: string
  readonly skuName: string
}

function parseFamilyId(selectionId: string): SelectedFamily | null {
  if (!selectionId.startsWith("fam:")) return null
  const rest = selectionId.slice("fam:".length)
  const sep = rest.indexOf(":")
  if (sep === -1) return { familyId: rest, familyName: "" }
  return {
    familyId: rest.slice(0, sep),
    familyName: rest.slice(sep + 1),
  }
}

function parseSkuId(selectionId: string): SelectedSku | null {
  if (!selectionId.startsWith("sku:")) return null
  const rest = selectionId.slice("sku:".length)
  // Format: sku:{familyId}:{familyName}:{skuId}:{skuName}
  // We encode using double-colon separator for names to keep parsing deterministic
  const parts = rest.split("|")
  if (parts.length < 4) return null
  return {
    familyId: parts[0]!,
    familyName: parts[1]!,
    skuId: parts[2]!,
    skuName: parts[3]!,
  }
}

export function makeFamilySelectionId(familyId: string, familyName: string): string {
  return `fam:${familyId}:${familyName}`
}

export function makeSkuSelectionId(
  familyId: string,
  familyName: string,
  skuId: string,
  skuName: string,
): string {
  return `sku:${familyId}|${familyName}|${skuId}|${skuName}`
}

export interface ProductSelectionState {
  readonly selectedIds: ReadonlySet<string>
  readonly count: number
  readonly toggle: (id: string) => void
  readonly selectAll: (ids: readonly string[]) => void
  readonly clearAll: () => void
  readonly isSelected: (id: string) => boolean
  readonly getSelectedFamilies: () => SelectedFamily[]
  readonly getSelectedSkus: () => SelectedSku[]
}

export function useProductSelection(): ProductSelectionState {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback((ids: readonly string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds],
  )

  const getSelectedFamilies = useCallback((): SelectedFamily[] => {
    const result: SelectedFamily[] = []
    for (const id of selectedIds) {
      const parsed = parseFamilyId(id)
      if (parsed) result.push(parsed)
    }
    return result
  }, [selectedIds])

  const getSelectedSkus = useCallback((): SelectedSku[] => {
    const result: SelectedSku[] = []
    for (const id of selectedIds) {
      const parsed = parseSkuId(id)
      if (parsed) result.push(parsed)
    }
    return result
  }, [selectedIds])

  return {
    selectedIds,
    count: selectedIds.size,
    toggle,
    selectAll,
    clearAll,
    isSelected,
    getSelectedFamilies,
    getSelectedSkus,
  }
}
