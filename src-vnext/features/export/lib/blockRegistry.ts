import type { BlockType } from "../types/exportBuilder"

export interface BlockRegistryEntry {
  readonly type: BlockType
  readonly label: string
  readonly description: string
  readonly icon: string // lucide icon name
  readonly category: "content" | "data" | "layout"
  readonly accentColor: string // tailwind color for sidebar accent
}

export const BLOCK_REGISTRY: readonly BlockRegistryEntry[] = [
  {
    type: "text",
    label: "Text",
    description: "Free-form with variables",
    icon: "Type",
    category: "content",
    accentColor: "blue",
  },
  {
    type: "image",
    label: "Image",
    description: "Logos, reference images",
    icon: "Image",
    category: "content",
    accentColor: "purple",
  },
  {
    type: "shot-grid",
    label: "Shot Grid",
    description: "Table of shots + thumbnails",
    icon: "Grid3X3",
    category: "data",
    accentColor: "green",
  },
  {
    type: "shot-detail",
    label: "Shot Detail",
    description: "Individual shot card",
    icon: "Square",
    category: "data",
    accentColor: "green",
  },
  {
    type: "product-table",
    label: "Product Table",
    description: "Product list with SKUs",
    icon: "Table",
    category: "data",
    accentColor: "teal",
  },
  {
    type: "pull-sheet",
    label: "Pull Sheet",
    description: "Items + fulfillment status",
    icon: "ClipboardList",
    category: "data",
    accentColor: "amber",
  },
  {
    type: "crew-list",
    label: "Crew List",
    description: "Department-grouped roster",
    icon: "Users",
    category: "data",
    accentColor: "indigo",
  },
  {
    type: "divider",
    label: "Divider",
    description: "Horizontal rule",
    icon: "Minus",
    category: "layout",
    accentColor: "zinc",
  },
  {
    type: "page-break",
    label: "Page Break",
    description: "Force new page",
    icon: "FileDown",
    category: "layout",
    accentColor: "zinc",
  },
] as const
