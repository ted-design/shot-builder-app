# Component Checklist: SetHero UI Parity

This document maps SetHero components to Shot Builder components with specific acceptance criteria for achieving visual parity.

---

## Overview

| # | Component | Priority | SetHero Location | My App Location | Status |
|---|-----------|----------|------------------|-----------------|--------|
| 1 | Schedule Preview Canvas | P1 | Main preview area (iframe) | `SchedulePreview.jsx` | Pending |
| 2 | Crew/Department Tables | P1 | Inside preview iframe | `CrewTable.jsx`, `TalentTable.jsx` | Pending |
| 3 | Schedule Table | P1 | Inside preview (Today's Schedule) | `ScheduleTable.jsx` | Pending |
| 4 | Layout Panel | P2 | Left of preview area | `LayoutPanel.jsx` / `LayoutSidebar.jsx` | Pending |
| 5 | Layout Panel Items | P2 | Inside layout panel | `LayoutPanelItem.jsx` | Pending |
| 6 | Primary Button | P2 | "Go to Publish" | `Button.jsx` | Pending |
| 7 | Secondary Button | P2 | "Re-Publish", "Load / Save" | `Button.jsx` | Pending |
| 8 | Top Action Bar | P3 | Above preview area | `ActionBar.jsx` / inline | Pending |
| 9 | Breadcrumbs | P3 | Top of page | `Breadcrumbs.jsx` | Pending |
| 10 | Icon Sidebar | P3 | Left edge | `Sidebar.jsx` | Pending |
| 11 | Preview Controls | P3 | Above preview (zoom, mobile toggle) | Inline in preview area | Pending |
| 12 | Call Sheet Header | P1 | Top of preview document | `CallSheetHeader.jsx` | Pending |

---

## Phase 1: Call Sheet Preview & Tables (Highest Impact)

### 1. Schedule Preview Canvas

**SetHero Description:**
- White document-like preview inside an iframe
- Scaled to fit viewport with zoom controls
- Paper-like appearance with content sections

**My App Location:**
- `src/components/callsheet/SchedulePreview.jsx` (or similar)
- `src/pages/SchedulePage.jsx`

**Tokens Used:**
- `--color-surface` (white background)
- `--color-border` (subtle border around preview)
- `--radius-lg` (8px rounded corners)

**Changes Required:**
- [ ] Add subtle border around preview card: `1px solid var(--color-border)`
- [ ] Ensure white background: `var(--color-surface)`
- [ ] Add appropriate padding inside preview

**Acceptance Criteria:**
```
Preview container:
  - background-color: #ffffff (white)
  - border: 1px solid #e2e8f0 (slate-200)
  - border-radius: 8px
  - box-shadow: none (or very subtle)
  - padding: 0 (content handles own padding)
```

---

### 2. Crew/Department Tables (PRODUCTION, WARDROBE, etc.)

**SetHero Description:**
- Section header with department name (e.g., "PRODUCTION")
- Dashed top border separating sections
- Table rows with: Role | Name | Phone/Email | Call Time
- Compact row heights, subtle cell borders
- No colored header bars

**My App Location:**
- `src/components/callsheet/CrewSection.jsx`
- `src/components/callsheet/CrewTable.jsx`

**Tokens Used:**
- `--table-section-border`: `1px dashed #dadada`
- `--table-cell-border`: `1px solid rgba(214,214,214,0.44)`
- `--table-header-font-size`: `13px`
- `--table-header-text-transform`: `uppercase`
- `--table-row-height`: `44px`
- `--table-cell-padding`: `8px 12px`

**Changes Required:**
- [ ] **CRITICAL**: Remove solid colored header bars
- [ ] Replace with text-only section header + dashed top border
- [ ] Section header: 13px, uppercase, normal weight
- [ ] Add dashed top border to section headers
- [ ] Reduce row height to 44px
- [ ] Use subtle cell borders (not visible gridlines)

**Acceptance Criteria:**
```
Department Section Header:
  - font-size: 13px
  - font-weight: 400
  - text-transform: uppercase
  - color: var(--color-text)
  - border-top: 1px dashed #dadada
  - padding: 8px 0 4px 6px
  - background: transparent

Table Row:
  - height: 44px
  - border-bottom: 1px solid rgba(214,214,214,0.44)

Table Cell (Role):
  - font-size: 13px
  - font-weight: 400
  - padding: 8px 12px
  - vertical-align: middle

Table Cell (Name/Contact):
  - font-size: 13px
  - color: var(--color-text)
  - Links: blue, underlined
```

---

### 3. Schedule Table (Today's Schedule)

**SetHero Description:**
- Similar to crew tables but with time-based rows
- Columns: Time | Description | Cast | Notes | Location
- Dashed section divider at top
- Compact styling

**My App Current State:**
- Uses solid indigo header bar
- Columns visible but styling differs

**My App Location:**
- `src/components/callsheet/ScheduleTable.jsx`
- `src/components/callsheet/TodaysSchedule.jsx`

**Changes Required:**
- [ ] **CRITICAL**: Remove indigo header bar
- [ ] Replace with text-only "Today's Schedule" header
- [ ] Add dashed top border
- [ ] Match row height and cell padding to crew tables

**Acceptance Criteria:**
```
Schedule Section Header:
  - text: "Today's Schedule" (with dropdown chevron)
  - font-size: 14px
  - font-weight: 400
  - color: var(--color-text)
  - border: none (or dashed top)
  - background: transparent
  - NO solid colored bar

Column Headers:
  - font-size: 12px
  - font-weight: 400 (or 500)
  - text-transform: uppercase
  - color: var(--color-text-muted)
  - background: transparent
  - padding: 8px 12px
```

---

### 4. Call Sheet Header

**SetHero Description:**
- Project title: "Unbound Merino - Q3 + BP" (28px, medium weight)
- Company name: "Immediate Group" (smaller, muted)
- Crew call time in circle badge: "7:00 AM"
- Date: "Wednesday, June 18, 2025"
- Day number: "Day 1"
- Location info boxes
- Weather widget

**My App Location:**
- `src/components/callsheet/CallSheetHeader.jsx`
- Part of preview component

**Tokens Used:**
- `--text-3xl` (28px) for project title
- `--weight-medium` (500)
- `--text-base` (14px) for body text
- `--color-text-muted` for secondary text

**Changes Required:**
- [ ] Project title: 28px, font-weight 500
- [ ] Crew call badge styling (circular with time)
- [ ] Verify layout matches: title left, date/day right
- [ ] Location boxes with proper borders

**Acceptance Criteria:**
```
Project Title:
  - font-size: 28px (1.75rem)
  - font-weight: 500
  - color: var(--color-text)
  - line-height: 1.25

Company/Subtitle:
  - font-size: 14px
  - color: var(--color-text-muted)

Crew Call Badge:
  - circular border
  - "CREW CALL" label above
  - Large time display inside

Date Display:
  - font-size: 14px-16px
  - Right-aligned
  - "Day X" below date
```

---

## Phase 2: Layout Panel Styling

### 5. Layout Panel Container

**SetHero Description:**
- Light gray background: `#e0e4eb`
- Width: ~340px
- Horizontal padding: 16px left, 29px right
- Contains section list with drag handles

**My App Current State:**
- Width: 280px
- Background: transparent
- No padding visible

**My App Location:**
- `src/components/callsheet/LayoutPanel.jsx`
- `src/components/callsheet/LayoutSidebar.jsx`

**Tokens Used:**
- `--layout-panel-width`: `320px`
- `--color-surface-muted`: `#e0e4eb`
- `--layout-panel-padding-x`: `16px`

**Changes Required:**
- [ ] Add background color: `var(--color-surface-muted)`
- [ ] Increase width to 320px
- [ ] Add horizontal padding: 16px

**Acceptance Criteria:**
```
Layout Panel Container:
  - width: 320px
  - background-color: #e0e4eb
  - padding: 0 16px
  - border-right: none (or subtle)
```

---

### 6. Layout Panel Items

**SetHero Description:**
- List items with icons and text
- Selected item: blue background, white text
- Drag handles on left
- Eye icon for visibility toggle
- Arrow icon for expansion

**My App Location:**
- `src/components/callsheet/LayoutPanelItem.jsx`
- Part of LayoutPanel component

**Tokens Used:**
- `--color-primary` for selected background
- `--text-base` (14px) for text
- `--radius-md` (6px) for item border radius
- `--space-2` to `--space-3` for padding

**Changes Required:**
- [ ] Reduce font size to 14px
- [ ] Ensure selected state uses primary color background
- [ ] Add proper padding: ~10px 12px
- [ ] Add subtle hover state

**Acceptance Criteria:**
```
Layout Item (Default):
  - font-size: 14px
  - font-weight: 400
  - color: var(--color-text)
  - background: transparent
  - padding: 10px 12px
  - border-radius: 6px

Layout Item (Selected):
  - background-color: var(--color-primary) (#6366f1 or #1f66d9)
  - color: white
  - font-weight: 400

Layout Item (Hover):
  - background-color: rgba(0,0,0,0.05)
```

---

### 7. Primary Button

**SetHero Description:**
- "Go to Publish" button
- Blue background: `#1f66d9`
- Height: 46px
- Font: 18px, weight 600
- Padding: 5px 24px
- Border radius: 6px

**My App Current State:**
- Uses indigo: `#6366f1`
- Height: 40px
- Font: 14px, weight 400

**My App Location:**
- `src/components/common/Button.jsx`
- `src/components/ui/button.jsx` (shadcn)

**Tokens Used:**
- `--btn-height-lg`: `46px`
- `--btn-padding-x-lg`: `24px`
- `--text-xl`: `18px`
- `--weight-semibold`: `600`
- `--color-primary` or `--color-sethero-blue`

**Changes Required:**
- [ ] Create "large" button variant
- [ ] Increase font size to 16-18px for large variant
- [ ] Increase font weight to 500-600
- [ ] Increase padding to 24px horizontal
- [ ] Consider blue color instead of indigo (optional)

**Acceptance Criteria:**
```
Primary Button (Large):
  - height: 46px
  - padding: 5px 24px
  - font-size: 18px
  - font-weight: 600
  - background-color: #6366f1 (or #1f66d9 for SetHero blue)
  - color: white
  - border-radius: 6px
  - hover: darker shade

Primary Button (Default):
  - height: 40px
  - padding: 8px 16px
  - font-size: 14px
  - font-weight: 500
```

---

### 8. Secondary Button

**SetHero Description:**
- "Re-Publish" button: light blue/gray filled `#b1c0d9`
- "Load / Save" button: appears as text/link style

**My App Current State:**
- Uses outline style (transparent + border)

**My App Location:**
- `src/components/common/Button.jsx`

**Changes Required:**
- [ ] Consider adding filled secondary variant
- [ ] OR keep outline style (acceptable alternative)

**Acceptance Criteria:**
```
Secondary Button (Filled):
  - background-color: #b1c0d9 (SetHero style)
  - color: white
  - Same sizing as primary

Secondary Button (Outline - Current):
  - background: transparent
  - border: 1px solid var(--color-border)
  - color: var(--color-text)
  - Acceptable alternative
```

---

## Phase 3: Top Chrome & Navigation

### 9. Top Action Bar

**SetHero Description:**
- Contains: Back arrow, "Main Schedule", date picker, "Editing Call Sheet" status, action icons, "Go to Publish" button
- Height: ~44px
- Gray/neutral background

**My App Location:**
- Part of page header
- `src/pages/SchedulePage.jsx`

**Changes Required:**
- [ ] Reduce overall top nav height to ~52px
- [ ] Add action bar section height: 44px
- [ ] Group controls appropriately

**Acceptance Criteria:**
```
Action Bar:
  - height: 44px
  - background: transparent or subtle
  - padding: 0 16px
  - align-items: center
```

---

### 10. Breadcrumbs

**SetHero Description:**
- Path: All Companies > Company > Project > Schedules > Call Sheet
- Small font, muted color
- Chevron separators

**My App Location:**
- `src/components/common/Breadcrumbs.jsx`

**Changes Required:**
- [ ] Verify font size is 13-14px
- [ ] Use muted color for separators
- [ ] Ensure proper spacing

**Acceptance Criteria:**
```
Breadcrumbs:
  - font-size: 14px
  - color: var(--color-text-muted)
  - separator: chevron or ">"
  - Current page: slightly bolder or darker
```

---

### 11. Icon Sidebar

**SetHero Description:**
- Full sidebar with text labels: 220px wide
- Dark navy background: `#1a2b3d`
- White icons, muted text

**My App Current State:**
- Icon-only rail: 64px wide
- Dark background: `#0f172a`

**My App Location:**
- `src/components/layout/Sidebar.jsx`

**Changes Required:**
- [ ] Keep icon rail (different architecture is fine)
- [ ] Verify dark background color matches
- [ ] Ensure icon/hover states are consistent

**Acceptance Criteria:**
```
Icon Sidebar:
  - width: 64px (keep current)
  - background: #0f172a (slate-900) - acceptable
  - Icons: white/gray, hover highlight
```

---

### 12. Preview Controls

**SetHero Description:**
- Zoom: 100% with +/- buttons
- "Show mobile" checkbox
- Refresh button
- "Full Screen" button

**My App Location:**
- Above preview area
- Part of `SchedulePreview.jsx`

**Changes Required:**
- [ ] Ensure consistent button styling
- [ ] Verify zoom controls work
- [ ] Match icon button sizes (32px)

**Acceptance Criteria:**
```
Preview Controls:
  - font-size: 14px for labels
  - icon buttons: 32px square
  - grouped together horizontally
  - right-aligned above preview
```

---

## Implementation Phases Summary

### Phase 1: Preview & Tables (Highest Impact)
**Files to modify:**
- `src/components/callsheet/SchedulePreview.jsx`
- `src/components/callsheet/CrewTable.jsx` / `CrewSection.jsx`
- `src/components/callsheet/ScheduleTable.jsx`
- `src/components/callsheet/CallSheetHeader.jsx`

**Key changes:**
1. Remove solid colored table header bars
2. Add dashed section dividers
3. Reduce font sizes to 13-14px
4. Standardize row heights to 44px
5. Update call sheet header typography

**Definition of Done:**
- [ ] All table headers use text-only style with dashed borders
- [ ] No solid colored bars visible in preview
- [ ] Row heights consistent at 44px
- [ ] Font sizes match spec (13px tables, 28px title)
- [ ] Screenshots show clear visual improvement toward SetHero style

**Risks:**
- May require restructuring table components
- CSS specificity conflicts with existing styles
- Responsive behavior may need adjustment

---

### Phase 2: Layout Panel
**Files to modify:**
- `src/components/callsheet/LayoutPanel.jsx`
- `src/components/callsheet/LayoutPanelItem.jsx`
- `src/components/common/Button.jsx`

**Key changes:**
1. Add gray background to layout panel
2. Increase panel width to 320px
3. Add horizontal padding
4. Update button typography for large variant

**Definition of Done:**
- [ ] Layout panel has `#e0e4eb` background
- [ ] Panel width is 320px
- [ ] Layout items have proper padding and hover states
- [ ] Primary buttons use 16-18px font size

**Risks:**
- Width change may affect responsive breakpoints
- Need to ensure drag-and-drop still works

---

### Phase 3: Top Chrome
**Files to modify:**
- `src/components/layout/Sidebar.jsx`
- `src/components/common/Breadcrumbs.jsx`
- `src/pages/SchedulePage.jsx` (action bar area)

**Key changes:**
1. Reduce top nav height
2. Verify breadcrumb styling
3. Ensure consistent icon button sizes

**Definition of Done:**
- [ ] Top bar height reduced to ~52px
- [ ] Breadcrumbs match spec
- [ ] Icon buttons are 32px square

**Risks:**
- Low risk - mostly minor tweaks
- Test on smaller screens

---

## Testing Checklist

After implementation, verify:

- [ ] Preview renders correctly at 100% zoom
- [ ] Zoom controls work (50%, 75%, 100%, 125%, 150%)
- [ ] Mobile preview toggle works
- [ ] Full screen mode works
- [ ] All table sections display correctly
- [ ] Drag-and-drop in layout panel still works
- [ ] Print/export functionality not affected
- [ ] Responsive behavior at tablet/mobile sizes
- [ ] No accessibility regressions (color contrast, focus states)
- [ ] No performance regressions
