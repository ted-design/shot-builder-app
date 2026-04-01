import type {
  ExportBlock,
  ExportDocument,
  ExportPage,
  ExportTemplate,
  PageSettings,
} from "../types/exportBuilder"

/** Add a block to a page */
export function addBlockToPage(
  doc: ExportDocument,
  pageId: string,
  block: ExportBlock,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? { ...page, blocks: [...page.blocks, block] }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Remove a block from a page */
export function removeBlockFromPage(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? { ...page, blocks: page.blocks.filter((b) => b.id !== blockId) }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Update a block's properties */
export function updateBlock(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
  updates: Record<string, unknown>,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            blocks: page.blocks.map((b) =>
              b.id === blockId ? { ...b, ...updates } as ExportBlock : b,
            ),
          }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Move a block within a page (reorder) */
export function moveBlock(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
  newIndex: number,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page

      const currentIndex = page.blocks.findIndex((b) => b.id === blockId)
      if (currentIndex === -1) return page

      const blocks = [...page.blocks]
      const [moved] = blocks.splice(currentIndex, 1)
      if (!moved) return page

      const clampedIndex = Math.max(0, Math.min(newIndex, blocks.length))
      blocks.splice(clampedIndex, 0, moved)

      return { ...page, blocks }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Add a new empty page */
export function addPage(doc: ExportDocument): ExportDocument {
  const newPage: ExportPage = {
    id: crypto.randomUUID(),
    blocks: [],
  }

  return {
    ...doc,
    pages: [...doc.pages, newPage],
    updatedAt: new Date().toISOString(),
  }
}

/** Remove a page */
export function removePage(
  doc: ExportDocument,
  pageId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.filter((p) => p.id !== pageId),
    updatedAt: new Date().toISOString(),
  }
}

/** Duplicate a page (deep copy with new ids) */
export function duplicatePage(
  doc: ExportDocument,
  pageId: string,
): ExportDocument {
  const sourcePage = doc.pages.find((p) => p.id === pageId)
  if (!sourcePage) return doc

  const duplicatedPage: ExportPage = {
    id: crypto.randomUUID(),
    blocks: sourcePage.blocks.map((block) => ({
      ...block,
      id: crypto.randomUUID(),
    })),
  }

  const sourceIndex = doc.pages.findIndex((p) => p.id === pageId)
  const newPages = [...doc.pages]
  newPages.splice(sourceIndex + 1, 0, duplicatedPage)

  return {
    ...doc,
    pages: newPages,
    updatedAt: new Date().toISOString(),
  }
}

/** Apply a template (replaces entire document content) */
export function applyTemplate(template: ExportTemplate): ExportDocument {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: template.name,
    pages: template.pages.map((page) => ({
      id: crypto.randomUUID(),
      blocks: page.blocks.map((block) => ({
        ...block,
        id: crypto.randomUUID(),
      })),
    })),
    settings: { ...template.settings },
    createdAt: now,
    updatedAt: now,
  }
}

/** Update page settings */
export function updateSettings(
  doc: ExportDocument,
  settings: PageSettings,
): ExportDocument {
  return {
    ...doc,
    settings: { ...settings },
    updatedAt: new Date().toISOString(),
  }
}
