# UI Parity Analysis: Layout Panel Gap & Add Affordances

**Date:** 2026-01-08
**Analyst:** Claude Code
**Status:** Discovery Complete - Ready for Review

---

## SCOPE DECLARATION

**Target Scope:** App Shell
**Affected Area:** Layout editor panel (section list + add/reorder controls + positioning relative to left nav)
**Reason for Scope Choice:** The mismatch is in the editor UI (left panel), not the preview rendering.

---

## REFERENCE URLS

- **SetHero:** https://my.sethero.com/portal/23598/callsheet/68357/build/outline
- **MyApp:** http://localhost:5173/projects/K5UpgJI9qeIz2l2oIKQg/schedule?scheduleId=DYVTVcjeRH7tId0iBj3s

---

## STEP A — VISUAL CAPTURE

### MyApp Screenshots (saved to `./screens/`)

| File | Description |
|------|-------------|
| `myapp_nav_collapsed_context.png` | MyApp with collapsed sidebar (~64px) showing gap between nav and Layout panel |
| `myapp_nav_expanded_context.png` | MyApp with expanded sidebar (~240px) showing gap persists |
| `myapp_gap_focus.png` | Zoomed view of Layout panel section list |
| `myapp_add_menu_open.png` | Add section dropdown menu open (header dropdown approach) |

### SetHero Screenshots (captured via browser automation)

| Chrome Screenshot ID | Description |
|---------------------|-------------|
| `ss_9977nv5ej` | SetHero full editor view showing Layout panel directly adjacent to left nav |
| `ss_1826ylsjc` | SetHero showing inline "+" add section affordance between Crew and Clients |

**Key Visual Observations:**
- SetHero: Layout panel starts immediately after left nav (0px gap)
- MyApp: ~32-64px dead zone between sidebar and Layout panel due to centering container
- SetHero: Inline "+" button appears between section items for insertion
- MyApp: Dropdown menu in header for adding sections (adds to end of list)

---

## STEP B — INITIAL DIAGNOSIS

### Issue A: LEFT GAP / POSITIONING

**Leading Hypothesis (HYPOTHESIS, not conclusion):**

The gap between the left sidebar and Layout panel is caused by the `max-w-[1440px] mx-auto px-4 py-6 md:px-8` container styling in `SidebarLayout.jsx`. The Schedule page is NOT marked as a "full-bleed" route, so it receives centering and padding that creates dead space.

This structural difference plausibly explains the visual mismatch because:
1. SetHero's content fills edge-to-edge within the available space
2. MyApp's centering creates visual disconnection between nav and content
3. The gap varies with viewport width due to `mx-auto` centering logic

### Issue B: ADD / MOVE AFFORDANCES

**Leading Hypothesis (HYPOTHESIS, not conclusion):**

MyApp lacks SetHero's inline insertion affordance because `LayoutPanel.jsx` only provides:
1. A header dropdown "+" menu (adds sections to end of list)
2. Per-row "More" menu with contextual options

SetHero provides:
1. Inline "+" button appearing between items on hover
2. Visual insertion point for specific position adding

---

## STEP C — MEASUREMENTS

### MyApp Layout (from code + screenshots)

| Metric | Value | Notes |
|--------|-------|-------|
| Sidebar width (expanded) | 240px | `SIDEBAR_WIDTH_EXPANDED` constant |
| Sidebar width (collapsed) | 64px | `SIDEBAR_WIDTH_COLLAPSED` constant |
| Content container padding | 32px | `px-8` = 2rem at md: breakpoint |
| Content max-width | 1440px | `max-w-[1440px]` constraint |
| Layout panel width | 280px | `OUTLINE_WIDTH` in WorkingPanel.jsx |
| Effective gap | ~32-64px | Variable based on viewport and centering |

### SetHero Layout (from screenshots)

| Metric | Value | Notes |
|--------|-------|-------|
| Left nav width | ~185px | Measured from screenshot |
| Layout panel start | 0px from nav | Directly adjacent |
| Layout panel width | ~210px | Estimated from screenshot |
| Content fills | 100% available | No centering gap |

### Key Discrepancies

1. **Gap presence**: SetHero 0px vs MyApp 32-64px
2. **Full-bleed behavior**: SetHero yes vs MyApp no (for schedule route)
3. **Add affordance location**: SetHero inline between items vs MyApp header dropdown

---

## STEP D — ALTERNATIVE HYPOTHESES & FALSIFICATION

### Issue A: Left Gap

**Alternative 1: Sidebar reserves extra space even when collapsed**

- **Evidence that would SUPPORT:** Gap stays constant regardless of sidebar state
- **Evidence that would DISPROVE:** Gap changes with viewport width (centering effect)
- **Verdict:** DISPROVED - Gap varies with viewport, confirming centering is involved

**Alternative 2: CallSheetBuilder has explicit left margin/padding**

- **Evidence that would SUPPORT:** Margin/padding found in CallSheetBuilder.jsx
- **Evidence that would DISPROVE:** Component uses only flex/gap, no left margin
- **Verdict:** DISPROVED - Checked line 973: `flex flex-1 min-h-0 gap-4`, no left margin

**Alternative 3: WorkingPanel has fixed left offset**

- **Evidence that would SUPPORT:** Left margin/padding in WorkingPanel.jsx
- **Evidence that would DISPROVE:** Only width and flex-shrink defined
- **Verdict:** DISPROVED - Uses `flex-shrink-0` and width (280px), no left margin

### Issue B: Add Affordance

**Alternative 1: Inline insertion exists but z-index is wrong**

- **Evidence that would SUPPORT:** Hover components rendered but hidden
- **Evidence that would DISPROVE:** No hover insertion components in LayoutPanel
- **Verdict:** DISPROVED - Feature not implemented

**Alternative 2: dnd-kit blocking insertion hover**

- **Evidence that would SUPPORT:** Drag zones consume hover events
- **Evidence that would DISPROVE:** Hover on non-drag areas shows no insertion UI
- **Verdict:** DISPROVED - Not a dnd-kit issue, feature doesn't exist

---

## STEP E — REPO DISCOVERY

### Commands Executed

```bash
# Find layout-related files
rg "isFullBleedRoute" src --files-with-matches

# Find sidebar layout
glob "src/components/layout/SidebarLayout.jsx"

# Find working panel constants
rg "OUTLINE_WIDTH|EDITOR_WIDTH" src
```

### Files Found

| File | Role |
|------|------|
| `src/components/layout/SidebarLayout.jsx` | Main shell layout - **ROOT CAUSE OF GAP** |
| `src/components/callsheet/builder/WorkingPanel.jsx` | Left panel container (280px) |
| `src/components/callsheet/builder/LayoutPanel.jsx` | Section list with drag-and-drop |
| `src/components/callsheet/CallSheetBuilder.jsx` | Main builder orchestrator |

### Critical Code Causing Gap

**SidebarLayout.jsx line 76:**
```jsx
const isFullBleedRoute = location.pathname.includes('/catalogue');
```

**SidebarLayout.jsx line 112:**
```jsx
<div className={isFullBleedRoute ? 'h-full' : 'max-w-[1440px] mx-auto px-4 py-6 md:px-8'}>
```

The `/schedule` route does NOT match `/catalogue`, so it receives:
1. `max-w-[1440px]` - constrains width
2. `mx-auto` - centers the container
3. `px-4 md:px-8` - adds 16-32px horizontal padding

Combined effect: Content is offset from the sidebar by padding + centering logic.

### Current Add Section Implementation (LayoutPanel.jsx)

**Header dropdown (lines 411-437):**
```jsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline" size="icon" className="h-7 w-7">
      <Plus className="h-3.5 w-3.5" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onClick={() => {...}}>Custom banner…</DropdownMenuItem>
    <DropdownMenuItem onClick={() => onAddSection("page-break")}>Page break</DropdownMenuItem>
    {/* etc */}
  </DropdownMenuContent>
</DropdownMenu>
```

**Per-row "More" menu (lines 313-318):**
- "Add banner below..."
- "Add page break below"

**Missing:** No inline "+" insertion affordance appearing between rows on hover.

---

## STEP F — ONE-DELTA PLAN

### Selected Delta: Fix the Left Gap (Issue A)

### Rationale for Selection

**Issue A (Gap) wins over Issue B (Inline Insertion) because:**

1. **Higher visual impact**: Gap is immediately visible and makes UI feel disconnected
2. **Simpler implementation**: Single condition change vs. new component + hover handling
3. **Foundational fix**: Correct positioning is prerequisite for future work
4. **Lower risk**: Changes only route detection, doesn't touch drag-drop logic

### Implementation

**File:** `src/components/layout/SidebarLayout.jsx`

**Current (line 76):**
```jsx
const isFullBleedRoute = location.pathname.includes('/catalogue');
```

**Proposed:**
```jsx
const isFullBleedRoute = location.pathname.includes('/catalogue') || location.pathname.includes('/schedule');
```

### Why This Delta Beats Alternatives

1. **vs. Removing padding globally:** Would break other pages that need centering
2. **vs. Adding margin to WorkingPanel:** Would be a bandaid, not fix the root cause
3. **vs. Custom CSS for schedule page:** Adds complexity, route detection is cleaner

### Guardrails — DO NOT TOUCH

- `LayoutPanel.jsx` - Do not modify drag-drop or add section logic
- `WorkingPanel.jsx` - Do not modify panel width or structure
- `CallSheetBuilder.jsx` - Do not modify layout structure
- Other routes - Only affect `/schedule` route behavior

---

## STEP G — READY-TO-EXECUTE PROMPT

```
CLAUDE CODE EXECUTION PROMPT (NEXT STEP)

## Scope Declaration
Target Scope: App Shell
Affected Area: Layout editor panel positioning relative to left nav
One Delta Only: Add /schedule to isFullBleedRoute condition

## Discovery Confirmation
Before editing, confirm:
1. File exists: src/components/layout/SidebarLayout.jsx
2. Line 76 contains: const isFullBleedRoute = location.pathname.includes('/catalogue');
3. Line 112 uses isFullBleedRoute for conditional className

## Exact Edit

File: src/components/layout/SidebarLayout.jsx
Line: 76

Change from:
const isFullBleedRoute = location.pathname.includes('/catalogue');

Change to:
const isFullBleedRoute = location.pathname.includes('/catalogue') || location.pathname.includes('/schedule');

## Guardrails
- Only edit SidebarLayout.jsx
- Only modify the isFullBleedRoute condition
- Do not touch any other files

## Verification

After implementation:
1. Navigate to: http://localhost:5173/projects/K5UpgJI9qeIz2l2oIKQg/schedule?scheduleId=DYVTVcjeRH7tId0iBj3s
2. With sidebar expanded: Layout panel should hug sidebar edge
3. With sidebar collapsed: Layout panel should shift left, maintaining adjacency
4. Navigate to /products: Should retain centered layout (not affected)
5. Navigate to /catalogue: Should remain full-bleed (unchanged)

## Files to Modify
- src/components/layout/SidebarLayout.jsx

## Files NOT to Modify
- LayoutPanel.jsx
- WorkingPanel.jsx
- CallSheetBuilder.jsx
- Any other files
```

---

## DEFERRED: Issue B (Inline Insertion Affordance)

This would require:
1. Adding hover zones between section items in LayoutPanel.jsx
2. Creating inline "Add Section" component with dropdown
3. Passing insertion position/index to `onAddSection` callback
4. Updating dnd-kit configuration to not interfere with hover zones

**Recommendation:** Tackle in separate session after gap is fixed. The gap fix is foundational and should be verified before adding more complex UI changes.

---

## DELIVERABLE CHECKLIST

- [x] Folder created: `docs/chatgpt/ui-parity/2026-01-08_1115/`
- [x] findings.md written with all required sections
- [x] Scope declaration included (verbatim format)
- [x] Initial diagnosis labeled as hypothesis
- [x] Measurements section with concrete values
- [x] Alternative hypotheses section with falsification criteria
- [x] Repo discovery with exact commands and file paths
- [x] One-delta plan with specific implementation
- [x] Execution prompt for next step
- [x] Screenshots captured (MyApp: 4 PNGs saved, SetHero: 2 Chrome captures referenced)
- [x] No repo files modified (except docs folder)
