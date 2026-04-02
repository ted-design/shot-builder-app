import type {
  ExportTemplate,
  PageSettings,
  TextBlock,
  ShotGridBlock,
  ShotDetailBlock,
  PullSheetBlock,
  CrewListBlock,
  PageBreakBlock,
} from "../types/exportBuilder"

const DEFAULT_SETTINGS: PageSettings = {
  layout: "portrait",
  size: "letter",
  fontFamily: "Inter",
}

const LANDSCAPE_SETTINGS: PageSettings = {
  ...DEFAULT_SETTINGS,
  layout: "landscape",
}

function headerBlock(content: string): TextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    content,
    typography: {
      fontSize: 24,
      textAlign: "left",
    },
  }
}

function subheaderBlock(content: string): TextBlock {
  return {
    id: crypto.randomUUID(),
    type: "text",
    content,
    typography: {
      fontSize: 14,
      fontColor: "#6b7280",
      textAlign: "left",
    },
  }
}

function pageBreak(): PageBreakBlock {
  return { id: crypto.randomUUID(), type: "page-break" }
}

/** Shot List — header + shot grid table */
const shotListTemplate: ExportTemplate = {
  id: "built-in-shot-list",
  name: "Shot List",
  description: "Tabular overview of all shots with thumbnails, status, and assignments",
  category: "built-in",
  settings: LANDSCAPE_SETTINGS,
  pages: [
    {
      id: crypto.randomUUID(),
      items: [
        headerBlock("{{projectName}} — Shot List"),
        subheaderBlock("{{shootDates}} | {{shotCount}} shots | Generated {{currentDate}}"),
        {
          id: crypto.randomUUID(),
          type: "shot-grid",
          columns: [
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
          ],
          sortBy: "shotNumber",
          sortDirection: "asc",
          tableStyle: {
            showBorders: true,
            showHeaderBg: true,
            stripeRows: true,
            cornerRadius: 4,
          },
        } satisfies ShotGridBlock,
      ],
    },
  ],
}

/** Storyboard — header + shot detail cards */
const storyboardTemplate: ExportTemplate = {
  id: "built-in-storyboard",
  name: "Storyboard",
  description: "Shot-by-shot breakdown with hero images, descriptions, and product assignments",
  category: "built-in",
  settings: DEFAULT_SETTINGS,
  pages: [
    {
      id: crypto.randomUUID(),
      items: [
        headerBlock("{{projectName}} — Storyboard"),
        subheaderBlock("{{shootDates}} | Generated {{currentDate}}"),
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: true,
          showNotes: true,
          showProducts: true,
        } satisfies ShotDetailBlock,
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: true,
          showNotes: true,
          showProducts: true,
        } satisfies ShotDetailBlock,
        pageBreak(),
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: true,
          showNotes: true,
          showProducts: true,
        } satisfies ShotDetailBlock,
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: true,
          showNotes: true,
          showProducts: true,
        } satisfies ShotDetailBlock,
      ],
    },
  ],
}

/** Lookbook — full-page hero images per shot */
const lookbookTemplate: ExportTemplate = {
  id: "built-in-lookbook",
  name: "Lookbook",
  description: "Full-page hero images with minimal text — ideal for client presentations",
  category: "built-in",
  settings: DEFAULT_SETTINGS,
  pages: [
    {
      id: crypto.randomUUID(),
      items: [
        headerBlock("{{projectName}}"),
        subheaderBlock("{{clientName}} | {{shootDates}}"),
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: false,
          showNotes: false,
          showProducts: false,
        } satisfies ShotDetailBlock,
        pageBreak(),
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: false,
          showNotes: false,
          showProducts: false,
        } satisfies ShotDetailBlock,
        pageBreak(),
        {
          id: crypto.randomUUID(),
          type: "shot-detail",
          showHeroImage: true,
          showDescription: false,
          showNotes: false,
          showProducts: false,
        } satisfies ShotDetailBlock,
      ],
    },
  ],
}

/** Pull Sheet — header + pull sheet data block */
const pullSheetTemplate: ExportTemplate = {
  id: "built-in-pull-sheet",
  name: "Pull Sheet",
  description: "Product pull list with fulfillment status for warehouse teams",
  category: "built-in",
  settings: DEFAULT_SETTINGS,
  pages: [
    {
      id: crypto.randomUUID(),
      items: [
        headerBlock("{{projectName}} — Pull Sheet"),
        subheaderBlock("{{shootDates}} | {{productCount}} products | Generated {{currentDate}}"),
        {
          id: crypto.randomUUID(),
          type: "pull-sheet",
          showFulfillmentStatus: true,
        } satisfies PullSheetBlock,
      ],
    },
  ],
}

/** Call Sheet Summary — crew list + notes */
const callSheetTemplate: ExportTemplate = {
  id: "built-in-call-sheet",
  name: "Call Sheet Summary",
  description: "Crew roster grouped by department with production notes",
  category: "built-in",
  settings: DEFAULT_SETTINGS,
  pages: [
    {
      id: crypto.randomUUID(),
      items: [
        headerBlock("{{projectName}} — Call Sheet"),
        subheaderBlock("{{shootDates}} | Generated {{currentDate}}"),
        {
          id: crypto.randomUUID(),
          type: "crew-list",
          groupByDepartment: true,
        } satisfies CrewListBlock,
        {
          id: crypto.randomUUID(),
          type: "text",
          content: "Production Notes",
          typography: {
            fontSize: 18,
            textAlign: "left",
          },
          layout: {
            marginTop: 24,
          },
        } satisfies TextBlock,
        {
          id: crypto.randomUUID(),
          type: "text",
          content: "",
          typography: {
            fontSize: 12,
            textAlign: "left",
          },
        } satisfies TextBlock,
      ],
    },
  ],
}

export const BUILT_IN_TEMPLATES: readonly ExportTemplate[] = [
  shotListTemplate,
  storyboardTemplate,
  lookbookTemplate,
  pullSheetTemplate,
  callSheetTemplate,
]
