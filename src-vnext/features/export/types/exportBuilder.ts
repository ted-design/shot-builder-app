/** Block types available in the export builder */
export type BlockType =
  | "text"
  | "image"
  | "shot-grid"
  | "shot-detail"
  | "product-table"
  | "pull-sheet"
  | "crew-list"
  | "divider"
  | "page-break"

/** Base block interface — all blocks extend this */
export interface BaseBlock {
  readonly id: string
  readonly type: BlockType
}

/** Layout properties shared by most blocks */
export interface BlockLayout {
  readonly minHeight?: number // px, 0 = auto
  readonly marginTop?: number
  readonly marginRight?: number
  readonly marginBottom?: number
  readonly marginLeft?: number
  readonly paddingTop?: number
  readonly paddingRight?: number
  readonly paddingBottom?: number
  readonly paddingLeft?: number
  readonly borderWidth?: number // px, 0 = none
  readonly borderColor?: string // hex
  readonly borderRadius?: number // px
  readonly borderStyle?: "solid" | "dashed" | "dotted" | "none"
  readonly backgroundColor?: string // hex, undefined = transparent
}

/** Table styling options */
export interface TableStyle {
  readonly showBorders?: boolean
  readonly showHeaderBg?: boolean
  readonly stripeRows?: boolean
  readonly cornerRadius?: number
}

/** Text block with rich content and variable tokens */
export interface TextBlock extends BaseBlock {
  readonly type: "text"
  readonly content: string // HTML or plain text with {{variable}} tokens
  readonly typography?: {
    readonly fontFamily?: string
    readonly fontSize?: number // px
    readonly fontColor?: string
    readonly textAlign?: "left" | "center" | "right"
    readonly highlightColor?: string // background color for text content area
    readonly blockType?: "p" | "h1" | "h2" | "h3"
  }
  readonly layout?: BlockLayout
}

/** Image block */
export interface ImageBlock extends BaseBlock {
  readonly type: "image"
  readonly src?: string // data URL or storage URL
  readonly alt?: string
  readonly width?: number // percentage 0-100
  readonly alignment?: "left" | "center" | "right"
  readonly layout?: BlockLayout
}

/** Column width preset options */
export type ColumnWidthPreset = "xs" | "sm" | "md" | "lg" | "xl" | "auto"

/** Column width preset labels and flex values */
export const COLUMN_WIDTH_PRESETS: Record<
  ColumnWidthPreset,
  { readonly label: string; readonly flex: number }
> = {
  xs: { label: "X-Small", flex: 0.5 },
  sm: { label: "Small", flex: 1 },
  md: { label: "Medium", flex: 2 },
  lg: { label: "Large", flex: 3 },
  xl: { label: "X-Large", flex: 4 },
  auto: { label: "Auto", flex: 1 },
} as const

/** Column definition for the shot grid block */
export interface ShotGridColumn {
  readonly key: string
  readonly label: string
  readonly visible: boolean
  readonly width?: ColumnWidthPreset
}

/** Shot grid block — table of shots from project */
export interface ShotGridBlock extends BaseBlock {
  readonly type: "shot-grid"
  readonly filter?: {
    readonly status?: readonly string[]
    readonly tagIds?: readonly string[]
  }
  readonly sortBy?: "shotNumber" | "title" | "status"
  readonly sortDirection?: "asc" | "desc"
  readonly columns: readonly ShotGridColumn[]
  readonly tableStyle?: TableStyle
  readonly layout?: BlockLayout
}

/** Shot detail block — single shot card */
export interface ShotDetailBlock extends BaseBlock {
  readonly type: "shot-detail"
  readonly shotId?: string
  readonly showHeroImage?: boolean
  readonly showDescription?: boolean
  readonly showNotes?: boolean
  readonly showProducts?: boolean
  readonly layout?: BlockLayout
}

/** Column definition for the product table block */
export interface ProductTableColumn {
  readonly key: string
  readonly label: string
  readonly visible: boolean
  readonly width?: ColumnWidthPreset
}

/** Product table block */
export interface ProductTableBlock extends BaseBlock {
  readonly type: "product-table"
  readonly columns: readonly ProductTableColumn[]
  readonly tableStyle?: TableStyle
  readonly layout?: BlockLayout
}

/** Pull sheet block */
export interface PullSheetBlock extends BaseBlock {
  readonly type: "pull-sheet"
  readonly pullId?: string
  readonly showFulfillmentStatus?: boolean
  readonly layout?: BlockLayout
}

/** Crew list block */
export interface CrewListBlock extends BaseBlock {
  readonly type: "crew-list"
  readonly groupByDepartment?: boolean
  readonly layout?: BlockLayout
}

/** Divider block */
export interface DividerBlock extends BaseBlock {
  readonly type: "divider"
  readonly style?: "solid" | "dashed" | "dotted"
  readonly color?: string
}

/** Page break block */
export interface PageBreakBlock extends BaseBlock {
  readonly type: "page-break"
}

/** Union of all block types */
export type ExportBlock =
  | TextBlock
  | ImageBlock
  | ShotGridBlock
  | ShotDetailBlock
  | ProductTableBlock
  | PullSheetBlock
  | CrewListBlock
  | DividerBlock
  | PageBreakBlock

/** A column within an HStack row */
export interface HStackColumn {
  readonly id: string
  readonly widthPercent: number
  readonly blocks: readonly ExportBlock[]
}

/** HStack row — holds 2-4 columns of blocks arranged horizontally */
export interface HStackRow {
  readonly id: string
  readonly type: "hstack"
  readonly columns: readonly HStackColumn[]
}

/** A page item is either a standalone block or an HStack row */
export type PageItem = ExportBlock | HStackRow

/** Type guard for HStack rows */
export function isHStackRow(item: PageItem): item is HStackRow {
  return "type" in item && (item as HStackRow).type === "hstack"
}

/** Page settings */
export interface PageSettings {
  readonly layout: "portrait" | "landscape"
  readonly size: "letter" | "a4" | "legal"
  readonly fontFamily: string
  readonly watermark?: {
    readonly text: string
    readonly opacity: number // 0-100
    readonly fontSize: number
    readonly color: string
  }
}

/** A single page in the document */
export interface ExportPage {
  readonly id: string
  readonly items: readonly PageItem[]
  /** @deprecated Use items instead. Kept for backward compatibility during migration. */
  readonly blocks?: readonly ExportBlock[]
}

/** A user-defined custom variable */
export interface CustomVariable {
  readonly key: string
  readonly label: string
  readonly value: string
}

/** The complete export document */
export interface ExportDocument {
  readonly id: string
  readonly name: string
  readonly pages: readonly ExportPage[]
  readonly settings: PageSettings
  readonly customVariables?: readonly CustomVariable[]
  readonly createdAt: string
  readonly updatedAt: string
}

/** Variable definition */
export interface ExportVariable {
  readonly key: string
  readonly label: string
  readonly value: string
  readonly source: "dynamic" | "custom"
}

/** Export template */
export interface ExportTemplate {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly category: "built-in" | "saved"
  readonly pages: readonly ExportPage[]
  readonly settings: PageSettings
}
