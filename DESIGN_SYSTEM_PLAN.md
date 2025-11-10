# Shot Builder Design System Implementation Plan

**Last Updated**: 2025-11-04
**Status**: Planning Phase
**Owner**: Ted Ghanime
**Estimated Timeline**: 4 weeks

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [MCP Server Requirements](#mcp-server-requirements)
3. [Brand Identity & Co-Branding](#brand-identity--co-branding)
4. [Current State Analysis](#current-state-analysis)
5. [Design System Foundations](#design-system-foundations)
6. [Implementation Phases](#implementation-phases)
7. [Progress Tracking](#progress-tracking)
8. [Success Metrics](#success-metrics)
9. [References](#references)

---

## Executive Summary

### Goals
Establish a comprehensive design system for Shot Builder to improve:
- **Visual Consistency**: Unified headers, typography, colors, and spacing
- **Brand Identity**: Co-branded experience with Immediate and Unbound Merino
- **User Experience**: Familiar patterns, clear navigation, reduced cognitive load
- **Developer Efficiency**: Reusable components, clear usage guidelines, reduced redundancy

### Current State
- **115 components** across well-organized architecture
- **5 different page header patterns** creating inconsistency
- **Color usage**: Ad-hoc application with mix of gray/slate neutrals
- **Design tokens**: Defined but not consistently enforced
- **Strong foundation**: Button, Card, Modal, and navigation systems work well

### Key Deliverables
1. Design system documentation with brand guidelines
2. Standardized PageHeader, Toolbar, and component library
3. All pages refactored to use consistent patterns
4. Co-branded header with Immediate + Unbound Merino logos
5. Updated color palette incorporating brand colors

---

## MCP Server Requirements

### Overview
This project **MANDATES** the use of installed MCP servers throughout all phases. These tools ensure code quality, up-to-date knowledge, proper testing, and component consistency.

### Installed MCP Servers

#### 1. Context7 (Documentation & Knowledge)
**Purpose**: Access most current documentation for libraries and frameworks

**Mandatory Usage:**
- ✅ **Before implementing any new component** - Query for latest patterns
- ✅ **Before using unfamiliar APIs** - Get current documentation
- ✅ **When debugging issues** - Look up latest solutions
- ✅ **Before choosing dependencies** - Research best practices

**Examples:**
```bash
# Query for React patterns
context7: "React context best practices 2025"

# Get Tailwind CSS updates
context7: "Tailwind CSS custom plugin creation"

# Research accessibility
context7: "ARIA labels for custom components WCAG 2.1"

# Component patterns
context7: "React compound component pattern"
```

**Integration Points:**
- Phase 1: Research design system patterns from leading libraries
- Phase 2: Query component patterns before building each component
- Phase 3: Look up migration strategies for large refactors
- Phase 5: Research latest accessibility standards

#### 2. Sequential Thinking (Complex Problem Solving)
**Purpose**: Break down complex refactoring tasks with iterative thinking

**Mandatory Usage:**
- ✅ **Before any major refactor** (touching 5+ files)
- ✅ **When planning component architecture**
- ✅ **When debugging complex issues**
- ✅ **When making breaking changes**

**Examples:**
```bash
# Plan a complex refactor
sequential-thinking: "Plan refactoring ProductsPage to use new PageHeader
component while maintaining all existing functionality and state management"

# Analyze architecture decisions
sequential-thinking: "Should we create a single Toolbar component or
separate components for different contexts? Consider reusability,
bundle size, and maintainability"

# Debug complex issues
sequential-thinking: "Dark mode logos not switching correctly. Current
implementation uses theme context. Analyze the problem and propose solutions"

# Migration planning
sequential-thinking: "Plan migration from gray-* to slate-* colors across
99 files while ensuring no visual regressions"
```

**Integration Points:**
- Phase 2: Plan architecture for each major component (PageHeader, Toolbar, etc.)
- Phase 3: Before refactoring each page, use sequential thinking to plan approach
- Phase 3: Before global migrations (colors, border radius)
- Phase 4: When consolidating redundant functions

#### 3. Chrome DevTools & Playwright MCP (Testing)
**Purpose**: Browser automation for visual testing and interaction testing

**Mandatory Usage:**
- ✅ **After implementing each new component** - Verify visual appearance
- ✅ **After each page refactor** - Test interactions and flows
- ✅ **Before/after major changes** - Visual regression testing
- ✅ **Accessibility testing** - Verify keyboard navigation and screen readers

**Chrome DevTools MCP Examples:**
```bash
# Take snapshot of current page state
chrome-devtools: take_snapshot

# Test component interactions
chrome-devtools: click element "Add Product button"
chrome-devtools: fill form with product data

# Debug rendering issues
chrome-devtools: evaluate_script "return window.getComputedStyle(...)"

# Performance profiling
chrome-devtools: performance_start_trace
```

**Playwright MCP Examples:**
```bash
# Visual regression testing
playwright: navigate http://localhost:5173/shots
playwright: take_screenshot filename="shots-page-before.png"
# ... make changes ...
playwright: take_screenshot filename="shots-page-after.png"

# Test responsive design
playwright: resize_browser 375 667  # Mobile
playwright: take_screenshot filename="shots-mobile.png"
playwright: resize_browser 1920 1080  # Desktop

# Accessibility testing
playwright: snapshot  # Get accessibility tree
playwright: press_key "Tab"  # Test keyboard navigation

# User flow testing
playwright: click "Create Shot button"
playwright: type "Shot Title" slowly=true submit=true
playwright: wait_for text="Shot created successfully"
```

**Integration Points:**
- Phase 2: After building each component, test in isolation
- Phase 3: After refactoring each page, run full interaction tests
- Phase 5.1: Complete visual regression suite (before/after screenshots)
- Phase 5.2: Accessibility audit with keyboard navigation tests

#### 4. Shadcn MCP (Component Library)
**Purpose**: Access to high-quality, accessible React components

**Mandatory Usage:**
- ✅ **Before building any new UI component** - Check if Shadcn has it
- ✅ **When enhancing existing components** - Reference Shadcn patterns
- ✅ **For accessibility patterns** - Use Shadcn's accessible implementations

**Examples:**
```bash
# Search for components
shadcn: search_items_in_registries query="dropdown menu" registries=["@shadcn"]

# Get component details
shadcn: view_items_in_registries items=["@shadcn/dropdown-menu"]

# Get usage examples
shadcn: get_item_examples_from_registries query="dropdown-menu demo" registries=["@shadcn"]

# Get installation command
shadcn: get_add_command_for_items items=["@shadcn/dropdown-menu"]
```

**Integration Points:**
- Phase 2: Before building OverflowMenu - check Shadcn dropdown patterns
- Phase 2: Before building BulkOperationsBar - reference Shadcn toolbar patterns
- Phase 4: Before enhancing command palette - check Shadcn combobox/command patterns
- Throughout: Reference Shadcn for accessibility patterns (ARIA, keyboard navigation)

### MCP Usage Workflow (MANDATORY)

Every implementation task MUST follow this workflow:

```
1. RESEARCH (Context7)
   ├─ Query latest documentation for relevant libraries
   ├─ Look up best practices for the pattern
   └─ Research potential pitfalls

2. PLAN (Sequential Thinking)
   ├─ Break down the task into steps
   ├─ Identify potential issues
   ├─ Plan migration/rollback strategy
   └─ Generate hypothesis and verify

3. REFERENCE (Shadcn)
   ├─ Check if component already exists
   ├─ Review accessibility patterns
   └─ Adapt to our design system

4. IMPLEMENT
   ├─ Write code following the plan
   ├─ Follow design system guidelines
   └─ Include tests

5. TEST (Chrome DevTools / Playwright)
   ├─ Visual testing (screenshots)
   ├─ Interaction testing (clicks, forms)
   ├─ Accessibility testing (keyboard, a11y tree)
   └─ Performance check

6. VALIDATE
   ├─ Compare before/after
   ├─ Verify no regressions
   └─ Document changes
```

### MCP Server Checklist

Before marking any phase as complete, verify:

- [ ] **Context7 used** to research latest patterns and documentation
- [ ] **Sequential Thinking used** to plan complex refactors (5+ files)
- [ ] **Shadcn consulted** for component patterns and accessibility
- [ ] **Playwright/Chrome DevTools used** for testing and screenshots
- [ ] All tests passing (visual, interaction, accessibility)
- [ ] Documentation updated with findings

**Failure to use MCP servers = Incomplete implementation**

---

## Brand Identity & Co-Branding

### Brand Analysis

#### Immediate
- **Identity**: Bold, dynamic media brand
- **Primary Color**: Immediate Red `#E31E24` (or similar)
- **Logo Elements**:
  - "IM" in red + "MEDIATE" in black (white backgrounds)
  - Full logo in red (black/dark backgrounds)
  - Play button icon (triangle) as distinctive element
- **Typography**: Bold, sans-serif
- **Personality**: Energetic, media-focused, production-oriented

#### Unbound Merino
- **Identity**: Clean, minimalist, sophisticated
- **Logo**: Wordmark-only, no icon
- **Typography**: Modern geometric sans-serif, well-spaced letterforms
- **Color**: Black or white (context-dependent)
- **Personality**: Refined, quality-focused, modern

### Co-Branding Strategy

#### Logo Placement
**Primary Header Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ [☰] [Immediate Logo] + [Unbound Logo] │ Project │ Theme │⚙│
└─────────────────────────────────────────────────────────────┘
```

**Specifications:**
- **Position**: Top-left of app header, after hamburger menu
- **Layout**: Horizontal lockup with visual separator
- **Size**: Logos scaled to 32px height on desktop, 24px on mobile
- **Separator**: Thin vertical line or subtle "+" between logos
- **Responsive**: Stack vertically on very small screens or show single logo with hover/tooltip

**Logo Component Structure:**
```jsx
<div className="flex items-center gap-3">
  <img
    src={theme === 'dark' ? ImmediateLogoWhite : ImmediateLogoColor}
    alt="Immediate"
    className="h-8"
  />
  <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
  <img
    src={theme === 'dark' ? UnboundLogoWhite : UnboundLogoBlack}
    alt="Unbound Merino"
    className="h-8"
  />
</div>
```

#### Brand Color Integration

**Updated Color Palette:**
```javascript
// Primary brand colors
immediate: {
  red: '#E31E24',      // Primary brand color
  darkRed: '#B51A1F',  // Hover/active state
}

unbound: {
  black: '#000000',
  white: '#FFFFFF',
}

// Existing system colors (preserve)
primary: '#6366f1',    // Indigo - Keep for UI actions
secondary: '#10b981',  // Emerald - Keep for success states
warning: '#f59e0b',    // Amber
danger: '#ef4444',     // Red (different from Immediate red)
```

**Color Usage Guidelines:**

| Element | Color | Usage |
|---------|-------|-------|
| **Logo lockup** | Immediate red + brand marks | Header only, not interactive |
| **Primary actions** | Indigo (`primary`) | Buttons, links, active states |
| **Status: Active** | Emerald (`secondary`) | Status badges, success states |
| **Status: Warning** | Amber (`warning`) | Alerts, pending states |
| **Status: Error** | Red (`danger`) | Errors, destructive actions |
| **Accents** | Immediate red (sparingly) | Call-to-action moments, featured items |
| **Neutrals** | Slate scale | All backgrounds, borders, text |

**Important**: Immediate red is a **brand color, not a UI color**. Use sparingly for:
- Logo presence
- Occasional high-priority CTAs (e.g., "Start Shoot" button)
- Featured content highlights

Do NOT use for: Standard buttons, links, or UI controls (use indigo `primary` instead).

---

## Current State Analysis

### ✅ What's Working Well
- **Component Architecture**: Well-organized, 115 components separated by domain
- **Core UI Primitives**: Button, Card, Modal, StatusBadge are well-designed
- **Dark Mode**: ~95% coverage with systematic theming
- **Navigation**: Modern SidebarLayout with consistent patterns
- **Icons**: Consistent Lucide React usage
- **Accessibility**: Modal focus trapping, semantic HTML, keyboard navigation

### ❌ Critical Issues

#### 1. Header Chaos (5 Different Patterns)
| Page | Pattern | Issues |
|------|---------|--------|
| ProductsPage | `text-2xl md:text-3xl font-bold` + sticky + shadow | ✓ Best pattern |
| PullsPage | `text-2xl font-semibold` + static | Different font weight, no sticky |
| TalentPage | No dedicated header | Missing hierarchy |
| LocationsPage | No dedicated header | Missing hierarchy |
| ShotsPage | Complex with tabs | Inconsistent structure |

#### 2. Color Inconsistency
- **551 background color occurrences** with ad-hoc application
- Mix of `gray-*` and `slate-*` for neutrals (no clear rule)
- Design tokens defined but not enforced

#### 3. Design Token Non-Compliance
- Config defines `rounded-card` (8px) but **464 occurrences of `rounded-md`** (6px)
- Developers using direct utilities instead of semantic tokens

#### 4. Typography Scale
- No documented scale
- Inconsistent font weights (`font-bold` vs `font-semibold`)
- Mixed responsive sizing patterns

#### 5. Spacing Inconsistencies
- Page wrappers: `space-y-6` vs `space-y-4` vs custom
- Card padding: `px-4 sm:px-6` vs `px-6` vs `p-4`

---

## Design System Foundations

### Color System

#### Semantic Color Tokens
```javascript
// tailwind.config.js additions

colors: {
  // Brand colors
  'immediate-red': '#E31E24',
  'immediate-red-dark': '#B51A1F',

  // UI colors (existing, keep)
  primary: '#6366f1',       // Indigo
  'primary-dark': '#4f46e5',
  secondary: '#10b981',     // Emerald
  warning: '#f59e0b',       // Amber
  danger: '#ef4444',        // Red

  // Neutrals (standardize on slate)
  neutral: {
    50: 'rgb(248 250 252)',   // slate-50
    100: 'rgb(241 245 249)',  // slate-100
    200: 'rgb(226 232 240)',  // slate-200
    300: 'rgb(203 213 225)',  // slate-300
    400: 'rgb(148 163 184)',  // slate-400
    500: 'rgb(100 116 139)',  // slate-500
    600: 'rgb(71 85 105)',    // slate-600
    700: 'rgb(51 65 85)',     // slate-700
    800: 'rgb(30 41 59)',     // slate-800
    900: 'rgb(15 23 42)',     // slate-900
    950: 'rgb(2 6 23)',       // slate-950
  },

  // Semantic aliases
  surface: {
    DEFAULT: 'rgb(255 255 255)',
    dark: 'rgb(30 41 59)',    // slate-800
  },
  muted: {
    DEFAULT: 'rgb(241 245 249)',  // slate-100
    dark: 'rgb(51 65 85)',        // slate-700
  },
}
```

### Typography Scale

```javascript
// Typography semantic classes
.heading-page {
  @apply text-2xl md:text-3xl font-bold text-neutral-900 dark:text-neutral-100;
}

.heading-section {
  @apply text-xl font-semibold text-neutral-900 dark:text-neutral-100;
}

.heading-subsection {
  @apply text-lg font-semibold text-neutral-900 dark:text-neutral-100;
}

.body-text {
  @apply text-sm text-neutral-700 dark:text-neutral-300;
}

.body-text-muted {
  @apply text-sm text-neutral-600 dark:text-neutral-400;
}

.caption {
  @apply text-xs text-neutral-600 dark:text-neutral-400;
}

.label {
  @apply text-sm font-medium text-neutral-900 dark:text-neutral-100;
}
```

### Spacing Scale

```javascript
// Page-level spacing
.page-wrapper {
  @apply space-y-6;
}

.section-gap {
  @apply gap-6;
}

.content-padding {
  @apply px-6 py-4;
}

// Component spacing
.card-padding {
  @apply p-6;
}

.toolbar-padding {
  @apply px-6 py-3;
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Establish design system documentation and tooling

#### MCP Server Requirements - Phase 1
```
✅ MANDATORY: Context7
   - Research design system best practices
   - Query Tailwind CSS plugin creation patterns
   - Look up design token standards

✅ MANDATORY: Sequential Thinking
   - Plan Tailwind plugin architecture
   - Break down design system structure
   - Plan migration strategy

✅ MANDATORY: Shadcn
   - Review Shadcn's design token approach
   - Study their component patterns
```

#### 1.1 Create Design System Documentation
**Before starting:**
1. **Context7**: Research "design system documentation best practices 2025"
2. **Context7**: Query "Tailwind CSS design tokens architecture"
3. **Sequential Thinking**: Plan structure and organization

- **File**: `src/styles/design-system.md`
- **Sections**:
  - Brand guidelines and co-branding rules
  - Color palette with semantic names
  - Typography scale with usage examples
  - Spacing and layout guidelines
  - Component patterns and when to use them
  - Accessibility requirements

#### 1.2 Setup Brand Assets
**Before starting:**
1. **Sequential Thinking**: Plan asset organization and naming convention
2. **Context7**: Research "React image asset optimization"

- **Directory**: `public/images/brands/`
- **Files**:
  ```
  brands/
  ├── immediate-logo-black.png
  ├── immediate-logo-white.png
  ├── unbound-logo-black.png
  ├── unbound-logo-white.png
  └── co-brand-lockup.svg (optional)
  ```
- **Component**: `src/components/common/BrandLockup.jsx`

**After implementation:**
1. **Playwright**: Test theme switching with screenshots
2. **Chrome DevTools**: Verify logo rendering in both themes

#### 1.3 Create Tailwind Design Token Plugin
**Before starting:**
1. **Context7**: "Tailwind CSS custom plugin creation guide"
2. **Sequential Thinking**: Plan plugin structure and utility classes
3. **Shadcn**: Review how Shadcn structures their Tailwind config

- **File**: `src/styles/design-tokens.js`
- **Purpose**: Extend Tailwind with semantic utility classes

**After implementation:**
1. **Playwright**: Test all utility classes render correctly
2. **Chrome DevTools**: Verify CSS output and specificity

#### 1.4 Update Tailwind Config
**Before starting:**
1. **Context7**: "Tailwind CSS semantic color naming conventions"
2. **Sequential Thinking**: Plan color migration strategy

- **File**: `tailwind.config.js`
- **Changes**: Add brand colors, standardize neutrals, import plugin

**Deliverables:**
- [ ] **Context7 consulted** for design system patterns
- [ ] **Sequential Thinking used** to plan plugin architecture
- [ ] **Shadcn reviewed** for token patterns
- [ ] `src/styles/design-system.md` complete
- [ ] Brand assets in `public/images/brands/`
- [ ] `BrandLockup.jsx` component with **Playwright tests**
- [ ] `src/styles/design-tokens.js` plugin
- [ ] Updated `tailwind.config.js`
- [ ] Migration guide for developers

---

### Phase 2: Core Components (Week 1-2)
**Goal**: Build standardized, reusable components

#### MCP Server Requirements - Phase 2
```
✅ MANDATORY for EACH component:
   1. Context7: Research component pattern
   2. Sequential Thinking: Plan component architecture
   3. Shadcn: Check for existing patterns
   4. Playwright/Chrome: Test after implementation
```

#### 2.1 BrandLockup Component
**File**: `src/components/common/BrandLockup.jsx`

**Before implementation:**
1. **Context7**: "React theme context logo switching patterns"
2. **Sequential Thinking**: Plan theme switching logic and image loading
3. **Shadcn**: Check if similar component exists

**Implementation:**
```jsx
export function BrandLockup({ size = 'md', className }) {
  const { theme } = useTheme();
  // ... implementation
}
```

**After implementation:**
1. **Playwright**: Test in light and dark mode
2. **Playwright**: Take screenshots of both themes
3. **Chrome DevTools**: Verify image loading and accessibility

**Test checklist:**
- [ ] Screenshots in light mode
- [ ] Screenshots in dark mode
- [ ] Theme toggle works correctly
- [ ] Responsive sizing on mobile
- [ ] Images have proper alt text

#### 2.2 PageHeader Component
**File**: `src/components/ui/PageHeader.jsx`

**Before implementation:**
1. **Context7**: "React compound component pattern best practices"
2. **Sequential Thinking**: Plan PageHeader API and props structure
3. **Shadcn**: Check breadcrumb and header patterns

**After implementation:**
1. **Playwright**: Test with/without actions, breadcrumbs, descriptions
2. **Playwright**: Test sticky behavior on scroll
3. **Chrome DevTools**: Verify z-index stacking
4. **Chrome DevTools**: Test accessibility tree

**Test checklist:**
- [ ] Sticky header works on scroll
- [ ] Actions slot renders correctly
- [ ] Breadcrumbs navigation works
- [ ] Responsive on mobile (title truncates)
- [ ] Keyboard navigation works

#### 2.3 Toolbar Component
**File**: `src/components/ui/Toolbar.jsx`

**Before implementation:**
1. **Context7**: "React toolbar component patterns"
2. **Sequential Thinking**: Plan Toolbar sections and layout system
3. **Shadcn**: Review Shadcn toolbar/command patterns

**After implementation:**
1. **Playwright**: Test left/right section positioning
2. **Playwright**: Test responsive wrapping
3. **Chrome DevTools**: Verify flexbox layout

#### 2.4 Enhanced Card Component
**Before implementation:**
1. **Shadcn**: Review Shadcn card component implementation
2. **Context7**: "React compound component sub-components"
3. **Sequential Thinking**: Plan CardActions, CardImage, CardBadge structure

**After implementation:**
1. **Playwright**: Screenshot all card variations
2. **Playwright**: Test hover effects
3. **Chrome DevTools**: Verify rounded corners use design tokens

#### 2.5 OverflowMenu Component
**Before implementation:**
1. **Shadcn**: Get dropdown-menu component
2. **Context7**: "React dropdown menu accessibility patterns"
3. **Sequential Thinking**: Plan menu structure and variants

**After implementation:**
1. **Playwright**: Test keyboard navigation (Tab, Enter, Escape)
2. **Playwright**: Test click interactions
3. **Chrome DevTools**: Verify ARIA attributes
4. **Chrome DevTools**: Test focus trapping

**Test checklist:**
- [ ] Opens on click
- [ ] Closes on Escape
- [ ] Keyboard navigation works
- [ ] ARIA attributes present
- [ ] Focus returns to trigger on close

#### 2.6 BulkOperationsBar Component
**Before implementation:**
1. **Context7**: "React selection state management patterns"
2. **Sequential Thinking**: Plan sticky positioning and portal rendering
3. **Shadcn**: Check for similar patterns

**After implementation:**
1. **Playwright**: Test sticky positioning
2. **Playwright**: Test on mobile (bottom positioning)
3. **Chrome DevTools**: Verify z-index and stacking

#### 2.7 LoadingState Component
**Before implementation:**
1. **Context7**: "React skeleton loading patterns"
2. **Shadcn**: Check Shadcn skeleton component
3. **Sequential Thinking**: Plan different skeleton types

**After implementation:**
1. **Playwright**: Screenshot all skeleton types
2. **Chrome DevTools**: Verify animation performance

**Deliverables:**
- [ ] All components have **Context7 research documented**
- [ ] All components have **Sequential Thinking planning**
- [ ] All components reference **Shadcn patterns**
- [ ] All components have **Playwright test suite**
- [ ] All components have **Chrome DevTools verification**
- [ ] Visual regression screenshots captured
- [ ] Accessibility tested (keyboard + a11y tree)

---

### Phase 3: Page Refactoring (Week 2-3)
**Goal**: Apply standardized components to all pages

#### MCP Server Requirements - Phase 3
```
✅ MANDATORY for EACH page:
   1. Sequential Thinking: Plan refactoring approach
   2. Playwright: Before screenshots
   3. Implement changes
   4. Playwright: After screenshots
   5. Playwright: Test interactions
   6. Chrome DevTools: Verify no regressions
```

#### 3.1 Update App Header with Co-Branding
**File**: `src/routes/SidebarLayout.jsx`

**Before refactoring:**
1. **Sequential Thinking**: "Plan refactoring SidebarLayout header to include BrandLockup while maintaining all existing functionality"
2. **Playwright**: `navigate http://localhost:5173` and screenshot current header
3. **Chrome DevTools**: Take snapshot of current layout

**After refactoring:**
1. **Playwright**: Screenshot new co-branded header (light + dark)
2. **Playwright**: Test theme toggle
3. **Chrome DevTools**: Verify logo spacing and alignment
4. **Playwright**: Test mobile responsive header

**Test checklist:**
- [ ] Before screenshot (current state)
- [ ] After screenshot (light mode)
- [ ] After screenshot (dark mode)
- [ ] Mobile screenshot (responsive)
- [ ] Theme toggle works
- [ ] Hamburger menu still functional

#### 3.2 Refactor Page Headers (Priority Order)

**For EACH page, follow this workflow:**

```
MANDATORY WORKFLOW:
1. Sequential Thinking: Plan refactoring approach
2. Playwright: Take "before" screenshot
3. Implement PageHeader component
4. Playwright: Take "after" screenshot
5. Playwright: Test interactions (buttons, search, filters)
6. Chrome DevTools: Verify accessibility
7. Document changes
```

**Priority 1: ShotsPage** (Most complex)

**Before starting:**
1. **Sequential Thinking**: "Plan refactoring ShotsPage header. Current has tabs, filters, and complex state. How to maintain all functionality while using new PageHeader component?"
2. **Context7**: "React tabs component patterns"
3. **Playwright**:
   ```
   navigate http://localhost:5173/shots
   take_screenshot filename="shots-before.png"
   snapshot  # Get current a11y tree
   ```

**After implementation:**
1. **Playwright**:
   ```
   navigate http://localhost:5173/shots
   take_screenshot filename="shots-after.png"
   click "Filter button"
   take_screenshot filename="shots-filter-panel.png"
   click "Create Shot"
   take_screenshot filename="shots-modal.png"
   ```
2. **Chrome DevTools**: Verify tab navigation and filter interactions
3. **Playwright**: Test responsive (resize 375x667, screenshot)

**Priority 2-7: Repeat workflow for each page**
- ProductsPage
- PullsPage
- TalentPage
- LocationsPage
- ProjectsPage
- OverviewPage

#### 3.3 Global Color Migration

**Before starting:**
1. **Sequential Thinking**: "Plan strategy for migrating 551 color occurrences from gray-* to slate-* across 99 files. How to ensure no visual regressions? Should we create automated script or manual review?"
2. **Context7**: "JavaScript AST parsing for CSS class replacement"

**Migration workflow:**
```
1. Sequential Thinking: Plan migration script
2. Playwright: Screenshot all pages BEFORE (create baseline)
3. Run migration script on subset (10 files)
4. Playwright: Screenshot those pages AFTER
5. Compare visually for regressions
6. If good, proceed with full migration
7. Playwright: Screenshot all pages AFTER
8. Visual diff comparison
```

**Playwright testing script:**
```javascript
// Create screenshots for all pages
const pages = [
  '/shots',
  '/products',
  '/pulls',
  '/talent',
  '/locations',
  '/projects',
  '/overview'
];

for (const page of pages) {
  await playwright.navigate(`http://localhost:5173${page}`);
  await playwright.take_screenshot({ filename: `${page.slice(1)}-after-colors.png` });
}
```

#### 3.4 Border Radius Compliance

**Before starting:**
1. **Sequential Thinking**: "Plan border radius migration. 464 occurrences of rounded-md need evaluation. Not all should change to rounded-card. How to categorize and migrate correctly?"

**After migration:**
1. **Playwright**: Screenshot all cards and buttons
2. **Chrome DevTools**: Verify computed border-radius values

**Deliverables:**
- [ ] **Sequential Thinking used** for each page refactor
- [ ] **Before/after screenshots** for all pages (Playwright)
- [ ] **Interaction tests** for all refactored pages (Playwright)
- [ ] **Accessibility verification** (Chrome DevTools)
- [ ] **Visual regression report** with all screenshots
- [ ] **Color migration complete** with before/after comparison
- [ ] **Border radius compliance** verified

---

### Phase 4: Navigation & Actions (Week 3-4)
**Goal**: Streamline navigation and reduce complexity

#### MCP Server Requirements - Phase 4
```
✅ MANDATORY:
   1. Context7: Research command palette and keyboard shortcut patterns
   2. Sequential Thinking: Plan action consolidation
   3. Shadcn: Check command and combobox components
   4. Playwright: Test all keyboard shortcuts
```

#### 4.1 Command Palette Enhancement
**File**: `src/components/ui/SearchCommand.jsx`

**Before implementation:**
1. **Context7**: "React command palette best practices 2025"
2. **Shadcn**: Get command component and examples
3. **Sequential Thinking**: "Plan command palette enhancement. Needs global search, actions, navigation, filters. How to structure command groups? How to handle async search?"

**After implementation:**
1. **Playwright**:
   ```
   navigate http://localhost:5173/shots
   press_key "Meta+k"  # Open command palette
   take_screenshot filename="command-palette-open.png"
   type "create shot" slowly=true
   take_screenshot filename="command-palette-search.png"
   press_key "Enter"
   wait_for text="New Shot"
   ```
2. **Chrome DevTools**: Verify keyboard event listeners
3. **Playwright**: Test all command categories

**Test checklist:**
- [ ] Cmd+K opens palette
- [ ] Escape closes palette
- [ ] Arrow keys navigate results
- [ ] Enter executes command
- [ ] Search works for all entity types
- [ ] Recent items shown first

#### 4.2 Consolidate Redundant Functions

**Before starting:**
1. **Sequential Thinking**: "Analyze all export, filter, and search implementations across codebase. Identify duplicated logic. Plan consolidation strategy to create shared components without breaking existing functionality."
2. **Context7**: "React component composition patterns"

**After consolidation:**
1. **Playwright**: Test export function on all pages
2. **Playwright**: Test filter function on all pages
3. **Playwright**: Test search function on all pages

#### 4.3 Keyboard Shortcuts

**Before implementation:**
1. **Context7**: "React keyboard shortcut library best practices"
2. **Sequential Thinking**: "Plan keyboard shortcut system. Need global listeners, conflict resolution, and discoverability. How to display shortcuts in UI?"

**After implementation:**
1. **Playwright**: Test every keyboard shortcut
   ```
   press_key "g"
   press_key "d"  # Go to dashboard
   # Verify navigation occurred

   press_key "c"  # Create
   # Verify command palette opened

   press_key "/"  # Focus search
   # Verify search input focused
   ```

**Test script:**
```javascript
const shortcuts = [
  { keys: ['Meta', 'k'], expected: 'Command palette opens' },
  { keys: ['Meta', '/'], expected: 'Sidebar toggles' },
  { keys: ['g', 'd'], expected: 'Navigate to dashboard' },
  { keys: ['g', 's'], expected: 'Navigate to shots' },
  { keys: ['c'], expected: 'Open create menu' },
  { keys: ['/'], expected: 'Focus search' },
];

for (const shortcut of shortcuts) {
  // Test each shortcut
}
```

**Deliverables:**
- [ ] **Context7 research** for command palette patterns
- [ ] **Shadcn command component** integrated
- [ ] **Sequential Thinking** used for consolidation planning
- [ ] **Playwright tests** for all keyboard shortcuts
- [ ] **Playwright tests** for command palette features
- [ ] Keyboard shortcut documentation
- [ ] Redundant code removed

---

### Phase 5: Polish & Validation (Week 4)
**Goal**: Ensure quality and gather feedback

#### MCP Server Requirements - Phase 5
```
✅ MANDATORY:
   1. Playwright: Complete visual regression suite
   2. Chrome DevTools: Accessibility audit
   3. Chrome DevTools: Performance profiling
   4. Context7: Research latest accessibility standards
```

#### 5.1 Visual Regression Testing

**Workflow:**
1. **Playwright**: Create comprehensive screenshot suite
   ```javascript
   // All pages, all states
   const pages = ['/shots', '/products', '/pulls', '/talent', '/locations', '/projects', '/overview'];
   const themes = ['light', 'dark'];
   const viewports = [
     { width: 375, height: 667, name: 'mobile' },
     { width: 768, height: 1024, name: 'tablet' },
     { width: 1920, height: 1080, name: 'desktop' },
   ];

   for (const page of pages) {
     for (const theme of themes) {
       for (const viewport of viewports) {
         // Screenshot each combination
       }
     }
   }
   ```

2. **Playwright**: Test all interactive states
   - Hover states
   - Focus states
   - Active/pressed states
   - Disabled states
   - Loading states
   - Error states

**Deliverables:**
- [ ] **Before screenshots** (all pages, viewports, themes)
- [ ] **After screenshots** (all pages, viewports, themes)
- [ ] **Side-by-side comparison** document
- [ ] **Regression report** (list any visual changes)

#### 5.2 Accessibility Audit

**Workflow:**
1. **Context7**: "WCAG 2.1 AAA compliance checklist 2025"
2. **Chrome DevTools**: Run accessibility audit on every page
   ```
   chrome-devtools: take_snapshot
   # Review accessibility tree for:
   # - Missing ARIA labels
   # - Incorrect heading hierarchy
   # - Missing alt text
   # - Color contrast issues
   ```

3. **Playwright**: Keyboard navigation testing
   ```
   navigate http://localhost:5173/shots
   press_key "Tab"  # Should focus first interactive element
   press_key "Tab"  # Should move to next element
   # Continue through entire page
   take_screenshot filename="keyboard-focus-trail.png"
   ```

4. **Chrome DevTools**: Color contrast analyzer
   ```
   evaluate_script `
     const elements = document.querySelectorAll('*');
     // Check contrast ratios
   `
   ```

**Test checklist:**
- [ ] All pages have h1
- [ ] Heading hierarchy is correct (no skipped levels)
- [ ] All images have alt text
- [ ] All buttons have accessible names
- [ ] All form inputs have labels
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] Keyboard navigation works completely
- [ ] Focus indicators visible
- [ ] Skip links functional
- [ ] ARIA labels on icon-only buttons

**Deliverables:**
- [ ] **Chrome DevTools accessibility audit** for all pages
- [ ] **Playwright keyboard navigation tests** passing
- [ ] **Contrast ratio report** (all text meets WCAG AA)
- [ ] **ARIA label audit** complete
- [ ] **0 critical/serious violations**

#### 5.3 Performance Audit

**Workflow:**
1. **Chrome DevTools**: Performance profiling
   ```
   chrome-devtools: performance_start_trace reload=true autoStop=true
   # Wait for trace to complete
   chrome-devtools: performance_stop_trace
   # Review insights
   ```

2. **Chrome DevTools**: Analyze bundle size
   ```
   chrome-devtools: list_network_requests
   # Check for:
   # - Large JavaScript bundles
   # - Unoptimized images
   # - Unnecessary requests
   ```

3. **Context7**: "React performance optimization techniques 2025"

**Metrics to measure:**
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Cumulative Layout Shift (CLS)
- Total Blocking Time (TBT)

**Test checklist:**
- [ ] FCP < 1.8s
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] TTI < 3.8s
- [ ] No layout shifts from images
- [ ] No JavaScript execution blocking render

**Deliverables:**
- [ ] **Chrome DevTools performance trace** for all pages
- [ ] **Network waterfall analysis**
- [ ] **Bundle size report**
- [ ] **Performance comparison** (before vs after)
- [ ] **Optimization recommendations**

#### 5.4 Documentation

**Before finalizing:**
1. **Context7**: "Technical documentation best practices"

**Update files:**
- `CLAUDE.md` - Add design system section
- `src/styles/design-system.md` - Complete reference
- Component usage examples
- Migration guide
- Changelog

**Deliverables:**
- [ ] All documentation updated
- [ ] Component examples created
- [ ] Migration guide complete
- [ ] Changelog with breaking changes

#### 5.5 User Testing

**Test scenarios** (using Playwright to demonstrate):
1. Create shot and add products
2. Filter and search shots
3. Create and export pull sheet
4. Manage project team

**Document findings and iterate**

**Deliverables:**
- [ ] User testing session recordings
- [ ] Findings document
- [ ] Prioritized improvement list

---

## Progress Tracking

### MCP Server Usage Tracking

**Track usage for accountability:**

| Phase | Context7 | Sequential Thinking | Shadcn | Playwright/Chrome |
|-------|----------|---------------------|--------|-------------------|
| Phase 1 | [ ] Used | [ ] Used | [ ] Used | [ ] Used |
| Phase 2 | [ ] Used | [ ] Used | [ ] Used | [ ] Used |
| Phase 3 | [ ] Used | [ ] Used | [ ] Used | [ ] Used |
| Phase 4 | [ ] Used | [ ] Used | [ ] Used | [ ] Used |
| Phase 5 | [ ] Used | [ ] Used | [ ] Used | [ ] Used |

**Each phase is incomplete without MCP server usage.**

### Week 1: Foundation & Core Components
- [ ] **Phase 1.1**: Design system documentation (+ Context7 research)
- [ ] **Phase 1.2**: Brand assets (+ Playwright testing)
- [ ] **Phase 1.3**: Tailwind plugin (+ Sequential Thinking planning)
- [ ] **Phase 1.4**: Config updated (+ Context7 color research)
- [ ] **Phase 2.1**: BrandLockup (+ Shadcn review + Playwright tests)
- [ ] **Phase 2.2**: PageHeader (+ all MCPs + tests)
- [ ] **Phase 2.3**: Toolbar (+ all MCPs + tests)

### Week 2: Components & Page Refactoring
- [ ] **Phase 2.4**: Card enhancements (+ Shadcn patterns)
- [ ] **Phase 2.5**: OverflowMenu (+ Shadcn dropdown + Playwright tests)
- [ ] **Phase 2.6**: BulkOperationsBar (+ tests)
- [ ] **Phase 2.7**: LoadingState (+ tests)
- [ ] **Phase 3.1**: App header co-branding (+ before/after screenshots)
- [ ] **Phase 3.2**: ShotsPage refactor (+ Sequential Thinking + Playwright)
- [ ] **Phase 3.2**: ProductsPage refactor (+ tests)

### Week 3: Complete Refactoring
- [ ] **Phase 3.2**: All pages refactored (+ screenshots for each)
- [ ] **Phase 3.3**: Toolbars standardized
- [ ] **Phase 3.4**: Cards refactored
- [ ] **Phase 3.5**: Color migration (+ visual regression)
- [ ] **Phase 3.6**: Border radius compliance
- [ ] **Phase 4.1**: Command palette (+ Shadcn + Playwright)

### Week 4: Polish & Validation
- [ ] **Phase 4.2**: Functions consolidated
- [ ] **Phase 4.3**: Keyboard shortcuts (+ Playwright tests)
- [ ] **Phase 4.4**: Mobile responsive verified
- [ ] **Phase 5.1**: Visual regression complete (Playwright suite)
- [ ] **Phase 5.2**: Accessibility audit (Chrome DevTools + 0 violations)
- [ ] **Phase 5.3**: Performance audit (Chrome DevTools)
- [ ] **Phase 5.4**: Documentation updated
- [ ] **Phase 5.5**: User testing complete

---

## Success Metrics

### Quantitative Goals
| Metric | Current | Target |
|--------|---------|--------|
| **Pages with standardized headers** | ~20% | 100% |
| **Design token compliance** | ~40% | 100% |
| **Color consistency (neutral-\* only)** | ~30% | 100% |
| **Border radius compliance** | ~50% | 100% |
| **Accessibility violations (axe)** | Unknown | 0 critical |
| **Lighthouse accessibility** | Unknown | 90+ |
| **Lighthouse performance** | Baseline | No regression |
| **Visual regression tests** | 0 | 100+ screenshots |
| **Keyboard navigation coverage** | Partial | 100% |

### MCP Server Usage Goals
- [ ] **Context7**: Used in 100% of research tasks
- [ ] **Sequential Thinking**: Used for all refactors 5+ files
- [ ] **Shadcn**: Consulted for all new UI components
- [ ] **Playwright/Chrome**: All pages tested with screenshots

---

## References

### MCP Server Documentation
- **Context7**: Query latest docs with `context7: "query"`
- **Sequential Thinking**: Use for complex planning
- **Shadcn**: Search components with `shadcn: search_items_in_registries`
- **Playwright**: Browser automation for testing
- **Chrome DevTools**: Page inspection and profiling

### Internal Documentation
- [Shot Builder Agent Reference](docs/shot_builder_agent_reference.md)
- [Shot Builder Structure](docs/shot_builder_structure.md)
- [CLAUDE.md](CLAUDE.md)

### External References
- [NN/g Design System Consistency](https://www.nngroup.com/articles/design-systems/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## Changelog

### 2025-11-04
- Initial design system plan created
- Co-branding strategy added
- **Mandatory MCP server usage integrated**
- Testing requirements specified
- 5-phase implementation plan with MCP checkpoints

---

## Next Steps

1. **Approve this plan** - Confirm mandatory MCP usage is acceptable
2. **Begin Phase 1** - Start with Context7 research for design systems
3. **Follow MCP workflow** - Every task must use appropriate MCPs
4. **Document MCP usage** - Track which servers used for each phase

**No phase is complete without MCP server verification.**

Ready to start with mandatory MCP integration? 🚀
