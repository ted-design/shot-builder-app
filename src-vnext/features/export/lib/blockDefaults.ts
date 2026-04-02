import type {
  BlockType,
  CrewListBlock,
  DividerBlock,
  ExportBlock,
  ImageBlock,
  PageBreakBlock,
  ProductTableBlock,
  PullSheetBlock,
  ShotDetailBlock,
  ShotGridBlock,
  ShotGridColumn,
  ProductTableColumn,
  TextBlock,
} from "../types/exportBuilder"

const DEFAULT_SHOT_GRID_COLUMNS: readonly ShotGridColumn[] = [
  { key: "shotNumber", label: "#", visible: true, width: "xs" },
  { key: "thumbnail", label: "Thumbnail", visible: true, width: "sm" },
  { key: "title", label: "Title", visible: true, width: "md" },
  { key: "status", label: "Status", visible: true, width: "sm" },
  { key: "products", label: "Products", visible: true, width: "md" },
  { key: "talent", label: "Talent", visible: true, width: "sm" },
  { key: "location", label: "Location", visible: true, width: "sm" },
  { key: "description", label: "Description", visible: false, width: "lg" },
  { key: "tags", label: "Tags", visible: false, width: "sm" },
  { key: "notes", label: "Notes", visible: false, width: "lg" },
]

const DEFAULT_PRODUCT_TABLE_COLUMNS: readonly ProductTableColumn[] = [
  { key: "styleName", label: "Style Name", visible: true, width: "lg" },
  { key: "styleNumber", label: "Style #", visible: true, width: "sm" },
  { key: "gender", label: "Gender", visible: true, width: "md" },
  { key: "skuCount", label: "SKUs", visible: true, width: "sm" },
  { key: "classification", label: "Classification", visible: true, width: "sm" },
]

function createTextBlock(): TextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    content: "",
    typography: {
      textAlign: "left",
    },
  }
}

function createImageBlock(): ImageBlock {
  return {
    id: crypto.randomUUID(),
    type: "image",
    width: 100,
    alignment: "center",
  }
}

function createShotGridBlock(): ShotGridBlock {
  return {
    id: crypto.randomUUID(),
    type: "shot-grid",
    columns: DEFAULT_SHOT_GRID_COLUMNS,
    sortBy: "shotNumber",
    sortDirection: "asc",
    tableStyle: {
      showBorders: true,
      showHeaderBg: true,
      stripeRows: false,
      cornerRadius: 4,
    },
  }
}

function createShotDetailBlock(): ShotDetailBlock {
  return {
    id: crypto.randomUUID(),
    type: "shot-detail",
    showHeroImage: true,
    showDescription: true,
    showNotes: false,
    showProducts: true,
  }
}

function createProductTableBlock(): ProductTableBlock {
  return {
    id: crypto.randomUUID(),
    type: "product-table",
    columns: DEFAULT_PRODUCT_TABLE_COLUMNS,
    tableStyle: {
      showBorders: true,
      showHeaderBg: true,
      stripeRows: true,
      cornerRadius: 4,
    },
  }
}

function createPullSheetBlock(): PullSheetBlock {
  return {
    id: crypto.randomUUID(),
    type: "pull-sheet",
    showFulfillmentStatus: true,
  }
}

function createCrewListBlock(): CrewListBlock {
  return {
    id: crypto.randomUUID(),
    type: "crew-list",
    groupByDepartment: true,
  }
}

function createDividerBlock(): DividerBlock {
  return {
    id: crypto.randomUUID(),
    type: "divider",
    style: "solid",
  }
}

function createPageBreakBlock(): PageBreakBlock {
  return {
    id: crypto.randomUUID(),
    type: "page-break",
  }
}

const BLOCK_FACTORIES: Record<BlockType, () => ExportBlock> = {
  "text": createTextBlock,
  "image": createImageBlock,
  "shot-grid": createShotGridBlock,
  "shot-detail": createShotDetailBlock,
  "product-table": createProductTableBlock,
  "pull-sheet": createPullSheetBlock,
  "crew-list": createCrewListBlock,
  "divider": createDividerBlock,
  "page-break": createPageBreakBlock,
}

/** Create a new block with sensible defaults for the given type */
export function createBlock(type: BlockType): ExportBlock {
  return BLOCK_FACTORIES[type]()
}
