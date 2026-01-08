import type { CallSheetSection } from "../../../types/callsheet";

function getOrder(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isVisible(value: unknown): boolean {
  return value !== false;
}

/**
 * Split a call sheet section list into pages based on `page-break` markers.
 * - Sorts by `order` first (stable).
 * - Filters out hidden sections (`isVisible === false`).
 * - Treats hidden page breaks as non-existent.
 * - Never returns trailing/empty pages from consecutive or terminal breaks.
 */
export function paginateCallSheetSections(
  sections: CallSheetSection[] | null | undefined
): CallSheetSection[][] {
  const list = Array.isArray(sections) ? sections : [];

  const ordered = list
    .map((section, index) => ({ section, index }))
    .filter(({ section }) => Boolean(section) && typeof section.id === "string" && typeof section.type === "string")
    .sort((a, b) => {
      const orderA = getOrder(a.section.order, a.index);
      const orderB = getOrder(b.section.order, b.index);
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map(({ section }) => section)
    .filter((section) => isVisible(section.isVisible));

  const pages: CallSheetSection[][] = [];
  let current: CallSheetSection[] = [];

  for (const section of ordered) {
    if (section.type === "page-break") {
      if (current.length > 0) pages.push(current);
      current = [];
      continue;
    }
    current.push(section);
  }

  if (current.length > 0) pages.push(current);

  return pages.length > 0 ? pages : [[]];
}

