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

/** Column definition for the shot grid block */
export interface ShotGridColumn {
  readonly key: string
  readonly label: string
  readonly visible: boolean
  readonly width?: "xs" | "sm" | "md" | "lg"
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
  readonly blocks: readonly ExportBlock[]
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
