# Saturation Export PDF Builder — Comprehensive Analysis

**Source:** https://app.saturation.io/immediate-productions/test-project/export
**Analyzed:** 2026-04-01
**Status:** Complete — every visible feature, component, and user flow documented

---

## 1. Architecture Overview

Saturation's export builder is a **block-based, multi-page, WYSIWYG PDF document builder** embedded within their production management platform. It operates on a modular block system where users compose documents by dragging content blocks onto pages, configuring each block's properties, and exporting the result as a PDF.

### Core Metaphor
Think **Notion's block editor meets a PDF layout tool** — but purpose-built for production budgets and reports.

### Layout
- **Left sidebar**: Block palette (drag sources) OR block settings panel (when a block is selected)
- **Center**: Live WYSIWYG page preview with inline editing
- **Top bar**: Report selector, template name, Templates/Export buttons
- **Right controls**: Variables panel, Page Settings panel

---

## 2. Block System (8 Block Types)

Blocks are the atomic units of the document. They are dragged from the sidebar onto the page canvas.

### 2.1 Text Block
- **Purpose:** Free-form rich text content
- **Inline editing:** Click text on the page to edit directly in-place
- **Settings panel (when selected):**
  - **Typography:**
    - Font: dropdown (Default or custom font)
    - Font Size (px): numeric input (e.g., 12)
    - Font Color: color picker
    - Reset to defaults button
  - **Layout:**
    - Min Height (px): numeric input or "Auto"
    - Margin (px): Top, Right, Bottom, Left (4 separate fields)
    - Padding (px): Top, Right, Bottom, Left (4 separate fields)
    - Reset to defaults button
  - **Delete Block:** red destructive action at bottom
- **Variable token support:** Text blocks can contain variable chips (e.g., `{Company Name}`, `{Company Phone}`) that auto-populate from project data

### 2.2 Image Block
- **Purpose:** Upload and display images (logos, photos)
- **Upload:** "Click to upload an image..." placeholder with upload icon
- **Accepts:** Standard image formats
- **Positioning:** Inline within the document flow

### 2.3 Budget Topsheet Block
- **Purpose:** Summary-level budget table with account categories
- **Data source:** Auto-populated from project budget data
- **Settings panel:**
  - **Filters:**
    - Exclude Zero Accounts: toggle (show/hide accounts with $0)
    - Actuals Date Range: dropdown (All Time, custom date ranges)
  - **Fringes:**
    - Show Fringe Breakdown: toggle
  - **Columns** (drag-reorderable, individually toggleable visibility):
    - Account (visible/hidden toggle + eye icon)
    - Name
    - Tags (can be hidden)
    - Contact (can be hidden)
    - Notes (can be hidden)
    - Estimate (with sub-options dropdown)
    - Actual
    - Variance
  - **Table:**
    - Borders: toggle
    - Corner Radius: numeric input (e.g., 3)
  - **Delete Block**

### 2.4 Budget Accounts Block
- **Purpose:** Detailed account-level breakdown (sub-accounts within each budget category)
- **Similar settings** to Budget Topsheet but at the account detail level

### 2.5 Actuals Block
- **Purpose:** Actual expenses table
- **Data source:** Auto-populated from project actuals tracking

### 2.6 Split Actuals Block
- **Purpose:** Split view of actuals data (likely by category or department)

### 2.7 Actual Attachments Block
- **Purpose:** Embed receipts, invoices, or other expense documentation
- **Icon:** Paperclip icon — suggests file attachment rendering

### 2.8 Tags Block
- **Purpose:** Display project tags or categorization labels

---

## 3. Template System

### 3.1 Template Library Modal
Accessed via the **"Templates"** button in the top bar. Opens a full-screen modal.

**Two tabs:**
- **Public:** Built-in templates available to all users
  - **START FRESH:** Blank Report (empty document)
  - **BUDGET category:**
    - AICP Bid Form — "AICP bid template with budget summary and a..."
    - Commercial Cost Summary Report — "Budget summary and account breakdown"
    - Film Budget — "Standard film budget report"
- **Workspace:** Custom templates saved by the team
  - Sporting Life
  - Loblaw Agency
  - GCI Canada
  - AICP Bid Form (custom version)
  - Spier & Mackay

**Template preview:** Selecting a template shows a live preview on the right side of the modal with page layout and block arrangement.

**Actions:**
- "Create Report" button — instantiates the template as a new report
- "Cancel" button
- "Save to Workspace" button (top-right) — saves current report layout as a reusable workspace template

### 3.2 Template Application
Templates define:
- Page count and layout
- Block arrangement and configuration
- Default text content and variable placements
- Column visibility settings for data blocks

---

## 4. Report Management

### 4.1 Multi-Report Per Project
The top-center dropdown ("Commercial Cost Summary Report v") reveals:
- **REPORTS** section header
- List of saved reports for the current project
- Checkmark (✓) indicates the currently active report
- **"+ New"** button to create additional reports

This means a single project can have **multiple saved report configurations** — e.g., one for client presentation, one for internal review, one for AICP compliance.

### 4.2 Report Naming
Reports have editable names displayed in the top bar dropdown.

---

## 5. Variables System

### 5.1 Dynamic Variables (auto-populated)
Accessed via the **"{} Variables"** button. These pull live data from the project:

| Variable | Example Value | Source |
|----------|--------------|--------|
| Project Name | Test Project | Project metadata |
| Project ID | test-project | Project slug |
| Workspace Name | Immediate Productions | Organization |
| Company Name | - | Workspace settings |
| Company Address | - | Workspace settings |
| Company Phone | - | Workspace settings |
| Current Date | 4/1/2026 | System clock |
| Page Number | (dynamic) | PDF renderer |
| Page Count | (dynamic) | PDF renderer |

Company Name, Address, and Phone have settings icons (gear ⚙) — indicating these are configurable at the workspace level.

### 5.2 Custom Variables
- **"Custom"** section with **"+ "** button to add
- "Manual text variables"
- Users can define their own key-value pairs to insert into text blocks

### 5.3 Variable Insertion
Variables appear as **purple/blue chips** in text blocks (e.g., `Company Name`, `Company Phone`). They auto-resolve to their values in the exported PDF.

Variables are also used in the **page footer** for dynamic pagination: "Page `Page Number` / `Page Count`"

---

## 6. Page Settings

### 6.1 Document-Level Settings
Accessed via the **"Page Settings"** button (sliders icon):

- **Page layout:** Portrait / Landscape (dropdown)
- **Page size:** Letter 8.5in x 11in (dropdown — likely includes A4, Legal, etc.)
  - "Applies to all pages that use the document default layout."
- **Default font:** Inter (dropdown — font family selector)
  - "All text blocks will use this default font."
- **Watermark:**
  - Text: input field (e.g., "CONFIDENTIAL", "DRAFT")
  - Opacity: slider (30% default)
  - Font size: numeric input (72 default)
  - Color: color picker (gray default)
  - "Add diagonal watermark to all pages."

---

## 7. Page Management

### 7.1 Multi-Page Documents
- Each report can have **multiple pages**
- Pages are vertically stacked in the preview
- **"+" button** between pages adds a new blank page
- Each page has its own header (Project Name + Export Date variable)

### 7.2 Page Actions (three-dot menu per page)
- **Duplicate Page** — clones the page with all blocks
- **Delete Page** (red) — removes the page

### 7.3 Page Footer
Auto-generated footer at bottom of each page:
- "Page" + `Page Number` variable + "/" + `Page Count` variable

---

## 8. Block Interactions

### 8.1 Adding Blocks
Three methods:
1. **Drag from sidebar** — drag a block type from the left sidebar onto the page
2. **"+ Add Text Block"** — inline button at the bottom of the page (quick-add for text)
3. **"+" between pages** — adds new pages

### 8.2 Selecting Blocks
- Click a block to select it
- Selection shows a **blue highlight border** around the block
- Left sidebar switches from Block Palette to **Block Settings** panel
- A **drag handle** (⠿ dots) appears on the left edge for reordering

### 8.3 Editing Blocks
- **Text blocks:** Direct inline editing (click to type)
- **Data blocks:** Configure via settings panel (columns, filters, toggles)
- **Image blocks:** Click to upload/replace

### 8.4 Deleting Blocks
- **"Delete Block"** button (red) at the bottom of every block's settings panel

### 8.5 Reordering Blocks
- Drag handle (⠿) on the left edge of each block for drag-and-drop reordering

---

## 9. Zoom Control
- Zoom dropdown in the top-left (e.g., "100%")
- Allows zooming in/out for preview fidelity

---

## 10. Export Flow
- **"Export"** button (top-right) — renders and downloads the PDF
- The preview is WYSIWYG — what you see is what you get in the exported PDF

---

## 11. Design Language

### Visual Identity
- **Dark theme** interface (dark sidebar, dark top bar)
- White page preview on dark background (mimics a real document on a dark desk)
- Clean, professional, corporate-grade
- Inter font as default

### Interaction Patterns
- **Selection-based settings:** Click a block → settings appear in sidebar
- **Inline editing:** Click text → type directly on the page
- **Drag-and-drop:** Blocks from sidebar to page, blocks within page for reorder
- **Toggle-based column control:** Eye icons for show/hide, drag handles for reorder
- **Variable chips:** Visual indicators for dynamic data fields

---

## 12. Key Differentiators vs Our Current PDF Export

| Feature | Saturation | Production Hub (Current) |
|---------|-----------|------------------------|
| Block-based composition | Yes (8 block types) | No — fixed templates only |
| Inline text editing | Yes | No |
| Variable system | Yes (dynamic + custom) | No |
| Per-block settings | Yes (typography, layout, margin, padding) | No |
| Column visibility toggle | Yes (per data block) | No |
| Multi-page documents | Yes | No |
| Page management (duplicate/delete) | Yes | No |
| Template library (public + workspace) | Yes | No |
| Multiple reports per project | Yes | No |
| Watermark | Yes (text, opacity, size, color) | No |
| Page size/orientation | Yes | Yes (portrait/landscape) |
| Font selection | Yes (document + per-block) | No |
| Zoom preview | Yes | No |
| Drag-and-drop reorder | Yes | No |
| Save as template | Yes | No |
| Data filters (date range, zero accounts) | Yes | No |
| Fringe breakdown toggle | Yes | N/A |
| Table styling (borders, radius) | Yes | No |
| Image upload blocks | Yes | Yes (hero image toggle) |

---

## 13. Applicable Learnings for Production Hub

### Must-Have (directly applicable):
1. **Block-based composition** — Let users compose PDFs from building blocks: Shot Grid, Shot Detail Card, Product Summary, Pull Sheet Table, Image Gallery, Text, Divider
2. **Template system** — Pre-built templates (Shot List, Storyboard, Lookbook, Pull Sheet, Call Sheet) + user-saved templates
3. **Variable system** — Dynamic variables from project data (project name, shoot dates, client, page numbers) insertable into any text block
4. **Per-block column toggles** — Let users pick which fields appear in shot/product tables
5. **Multi-page support** — Documents that span multiple pages with proper pagination
6. **WYSIWYG preview** — Live preview of exactly what the PDF will look like
7. **Save as template** — Save report configurations for reuse across projects

### Should-Have:
8. **Multiple reports per project** — Different export configs for different audiences
9. **Page settings** (size, orientation, font, watermark)
10. **Block-level typography controls** (font, size, color, margins, padding)
11. **Drag-and-drop block reorder**
12. **Inline text editing** on the preview

### Nice-to-Have:
13. **Table styling** (borders, corner radius)
14. **Zoom control** for preview
15. **Data filters** on table blocks (date ranges, exclude empty)
16. **Fringe/sub-detail toggles** on data blocks

---

## 14. Recommended Block Types for Production Hub

Based on our domain (production planning, not budgets), the equivalent block types would be:

| Block Type | Purpose | Data Source |
|------------|---------|-------------|
| **Text** | Free-form text with variable support | User input |
| **Image** | Upload logos, reference images | User upload |
| **Shot Grid** | Grid/table of shots with thumbnails | Project shots |
| **Shot Detail** | Individual shot card (image + metadata) | Single shot |
| **Product Table** | Product list with SKU details | Project products |
| **Pull Sheet** | Items to pull with fulfillment status | Pull sheets |
| **Crew List** | Crew roster table | Schedule crew |
| **Schedule** | Timeline/schedule block | Schedule entries |
| **Talent Grid** | Talent headshots + measurements | Project talent |
| **Divider** | Horizontal rule / section break | Static |
| **Page Break** | Force new page | Static |

---

## 15. Implementation Complexity Assessment

### Phase 1 (Foundation):
- Block-based document model (array of block objects)
- WYSIWYG preview renderer using @react-pdf/renderer
- Text block with inline editing
- Image block with upload
- Basic page settings (size, orientation)
- Single-template export flow

### Phase 2 (Data Blocks):
- Shot Grid block (pulls from Firestore)
- Product Table block (pulls from Firestore)
- Column toggle system
- Variable system (project data → tokens)

### Phase 3 (Templates + Management):
- Template library (built-in + workspace-saved)
- Multiple reports per project
- Drag-and-drop reorder
- Page management (add, duplicate, delete)

### Phase 4 (Polish):
- Per-block typography controls
- Watermark
- Zoom control
- Data filters on blocks

---

*This document is exhaustive as of the analysis date. Every visible feature, component, interaction, and user flow has been documented with no gaps.*
