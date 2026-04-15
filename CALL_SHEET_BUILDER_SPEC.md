# Shot Builder → Call Sheet Builder Enhancement Specification
## Version 1.0 | Implementation Guide for Claude Code/Codex CLI

---

## 📋 PROJECT OVERVIEW

### Current State (Shot Builder)
The app currently has:
- **Schedule page**: Basic schedule entries with shots, banners, time, duration, location, and notes
- **Preview panel**: Shows Time, Description, Talent, Products columns
- **Library**: Talent and Locations (organization-wide)
- **Assets**: Project-specific talent/location assignment
- **Products**: Product catalog
- **Settings**: Team members with roles (Producer, Admin)

### Target State (SetHero-like Call Sheet Builder)
Transform the Schedule page into a full-featured Call Sheet Builder with:
- Dynamic left sidebar panel that changes based on editing context
- Complete call sheet sections (Header, Day Details, Schedule, Talent, Crew, etc.)
- Section visibility toggles and reordering
- Page breaks and custom banners
- Multi-lane/multi-unit schedule support
- Complete crew management system
- Publishing and export capabilities

---

## 🏗️ ARCHITECTURE OVERVIEW

> **Design data models for the goal, not for the current feature set.** SetHero's scene data model has `slugline` / `pageCount` (fractional, 1/8 precision) / `storyDay` / `intExt` / `dayNight` fields despite having no script parser. These are producer-entered manual fields that unlock classic 1st-AD production workflows (coverage tracking, production reports) without requiring a script-importer engineering investment. When Shot Builder adds scene support, the scene schema should include these fields from day one even if no downstream feature uses them yet — the marginal cost is trivial (a few optional fields), and the option value is large (enables a later Production Reports / Coverage Tracker sprint without a schema migration). Sourced from `outputs/sethero-callsheet-spec-delta.md` Item 13.

### New Data Models Required
```typescript
// Departments & Positions
interface Department {
  id: string;
  name: string;
  order: number;
  positions: Position[];
  isVisible: boolean;
  organizationId: string;
}

interface Position {
  id: string;
  title: string;
  departmentId: string;
  order: number;
}

// Crew (Organization-wide library)
interface CrewMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  positionId: string;
  departmentId: string;
  company?: string;
  notes?: string;
  organizationId: string;
}

// Project Crew Assignment
interface ProjectCrewAssignment {
  id: string;
  projectId: string;
  crewMemberId: string;
  positionId: string; // Can override library position
  callTime?: string;
  wrapTime?: string;
  notes?: string;
}

// Call Sheet Configuration
interface CallSheetConfig {
  id: string;
  scheduleId: string;
  projectId: string;

  // Header Settings
  headerLayout: 'classic' | 'center-logo' | 'multiple-logos';
  headerElements: HeaderElement[];

  // Section Configuration
  sections: CallSheetSection[];

  // Display Settings
  pageSize: 'auto' | 'letter' | 'a4';
  spacing: 'compact' | 'normal' | 'relaxed';
  timeFormat: '12h' | '24h';
  temperatureFormat: 'celsius' | 'fahrenheit';
  showFooterLogo: boolean;
  colors: CallSheetColors;
}

interface CallSheetSection {
  id: string;
  slug: SectionSlug;
  displayTitle: string;  // user-editable label; defaults to the canonical display name for each slug
  isVisible: boolean;
  order: number;
  config: SectionConfig;
}

// Canonical section slugs — match SetHero's internal names where applicable,
// diverge where SB is extending (custom-banner) or collapsing (schedule).
// Slug is stable and machine-readable; the user-visible title lives on
// `CallSheetSection.displayTitle` so rename-in-place does not mutate the slug.
type SectionSlug =
  | 'header'            // SH parity (display: "Header")
  | 'day'               // SH parity slug (display: "Day Details")
  | 'reminders'         // SH parity (display: "Reminders")
  | 'schedule'          // SB unified — encompasses SH's today-schedule.
                        // Tomorrow-preview is a config flag (`showNextDayPreview`),
                        // NOT a separate section type. SH's `advanced-schedule`
                        // is collapsed into this.
  | 'clients'           // SH parity (display: "Clients")
  | 'cast'              // SH parity slug (display: "Talent")
  | 'extras'            // SH parity (display: "Extras and Dept. Notes")
  | 'page-break'        // SH parity (display: "Page Break")
  | 'crew'              // SH parity (display: "Crew")
  | 'notes'             // SH parity slug (display: "Notes & Contacts")
  | 'custom-banner';    // SB-only extension — no SH analogue. Full-width
                        // announcement block insertable between sections.

// NOTE: 'quote' (SetHero's disabled-by-default Quote of the Day) is intentionally
// omitted from the canonical taxonomy. Low demand for commercial/fashion producers;
// can be added later via a custom-section extension if the need emerges.
// Sourced from `outputs/sethero-callsheet-spec-delta.md` Item 2.

interface DayDetails {
  scheduleId: string;
  crewCallTime: string;
  shootingCallTime: string;
  breakfastTime?: string;
  firstMealTime?: string;
  secondMealTime?: string;
  estimatedWrap: string;

  // Locations
  productionOffice?: LocationReference;
  nearestHospital?: LocationReference;
  parking?: LocationReference;
  basecamp?: LocationReference;

  // Weather (auto-filled or manual)
  weather?: WeatherData;

  // Key People
  keyPeople?: string;
  setMedic?: string;
  scriptVersion?: string;
  scheduleVersion?: string;

  notes?: string;
}

interface TalentCallSheet {
  talentId: string;
  callTime: string;
  setTime?: string;
  wrapTime?: string;
  status?: 'confirmed' | 'pending' | 'cancelled';
  transportation?: string;
  notes?: string;
  colorCode?: string;
}

// Multi-lane Schedule Support
interface ScheduleEntry {
  // ... existing fields ...
  lane: number; // 1 = Main Unit, 2 = Second Unit, etc.
  unit: string; // "Main", "Motion", "Stills", etc.
}
```

### Patterns worth considering (speculative, not requirements)

SetHero's `crew_new` modal was observed to default `add_to_previous_reports: true` — meaning when a producer adds a crew member to a project, that crew member is **retroactively back-filled onto all prior Production Reports** so historical documents rebuild themselves as the project grows. **Medium confidence** — the field default was observed in the modal template but the behavior was not directly verified with live data. If Shot Builder ever ships Production Reports (tracked separately as a v2/v3 roadmap question, out of scope for this spec), this is a pattern worth prototyping: automatically back-fill late crew additions onto historical documents rather than leaving them as partial records. Not a hard recommendation. Sourced from `outputs/sethero-callsheet-spec-delta.md` Item 14.

---

## 🔧 IMPLEMENTATION PHASES

### PHASE 1: Foundation & Data Models (Week 1)

#### 1.1 Database Schema Updates
Create new Firestore collections:
```
/organizations/{orgId}/departments/{deptId}
/organizations/{orgId}/departments/{deptId}/positions/{posId}
/organizations/{orgId}/crew/{crewId}
/projects/{projectId}/crewAssignments/{assignmentId}
/projects/{projectId}/callSheetConfigs/{configId}
/projects/{projectId}/schedules/{scheduleId}/dayDetails/{detailId}
/projects/{projectId}/schedules/{scheduleId}/talentCalls/{callId}
```

#### 1.2 Create TypeScript Types
- Create `/src/types/callsheet.ts` with all interfaces above
- Create `/src/types/crew.ts` for crew-related types
- Create `/src/types/departments.ts` for department/position types

#### 1.3 Firebase Hooks
Create custom hooks:
- `useDepartments()` - CRUD for departments and positions
- `useOrganizationCrew()` - CRUD for crew library
- `useProjectCrew()` - CRUD for project crew assignments
- `useCallSheetConfig()` - Manage call sheet configuration
- `useDayDetails()` - Manage day details for a schedule

---

### PHASE 2: Departments & Crew Library (Week 2)

#### 2.1 Departments Management Page
**Route**: `/admin/departments` or `/settings/departments`

**Features**:
- Create/Edit/Delete departments
- Drag-and-drop reordering of departments
- Create/Edit/Delete positions within departments
- Preset templates (Film, Commercial, Fashion)
- Import/Export department configurations

**UI Components**:
```
/src/components/departments/
├── DepartmentList.tsx
├── DepartmentCard.tsx
├── PositionList.tsx
├── DepartmentDialog.tsx
├── PositionDialog.tsx
└── DepartmentPresets.tsx
```

**Default Departments to Pre-populate**:
```typescript
const defaultDepartments = [
  {
    name: "Production",
    positions: ["Producer", "Director", "Associate Producer", "Executive Producer",
                "Line Producer", "2nd Unit Director", "Unit Production Manager",
                "Production Coordinator", "Production Assistant", "Script Supervisor"]
  },
  {
    name: "Camera",
    positions: ["Director of Photography", "Camera Operator", "1st AC", "2nd AC",
                "DIT", "Steadicam Operator", "Drone Operator"]
  },
  {
    name: "Lighting",
    positions: ["Gaffer", "Best Boy Electric", "Electrician", "Grip", "Key Grip",
                "Best Boy Grip", "Dolly Grip"]
  },
  {
    name: "Art Department",
    positions: ["Production Designer", "Art Director", "Set Decorator",
                "Prop Master", "Set Dresser", "Scenic Artist"]
  },
  {
    name: "Wardrobe",
    positions: ["Costume Designer", "Wardrobe Supervisor", "Wardrobe Assistant",
                "Key Costumer", "Set Costumer"]
  },
  {
    name: "Hair & Makeup",
    positions: ["Makeup Department Head", "Key Makeup Artist", "Makeup Artist",
                "Hair Department Head", "Key Hair Stylist", "Hair Stylist"]
  },
  {
    name: "Sound",
    positions: ["Production Sound Mixer", "Boom Operator", "Sound Utility"]
  },
  {
    name: "Post Production",
    positions: ["Editor", "Assistant Editor", "Colorist", "VFX Supervisor"]
  },
  {
    name: "Talent Management",
    positions: ["Talent Coordinator", "Casting Director", "Extras Coordinator"]
  },
  {
    name: "Locations",
    positions: ["Location Manager", "Assistant Location Manager", "Location Scout"]
  }
];
```

#### 2.2 Crew Library Page
**Route**: `/library/crew`

**Features**:
- Add to Library > Talent, Locations, Tags, **Crew** (new tab)
- Grid/List view toggle
- Search and filter by department/position
- Bulk import from CSV
- Contact info (email, phone)
- Link to position/department

**UI Components**:
```
/src/components/crew/
├── CrewLibraryPage.tsx
├── CrewMemberCard.tsx
├── CrewMemberDialog.tsx
├── CrewBatchImport.tsx
├── CrewFilters.tsx
└── CrewTable.tsx
```

#### 2.3 Project Crew Assignment (Assets Page Update)
**Route**: `/projects/{projectId}/assets`

**Updates**:
- Add "Crew" section alongside Talent and Locations
- Ability to add crew from library to project
- Set project-specific call times
- Override position if needed

---

### PHASE 3: Call Sheet Builder UI Refactor (Weeks 3-4)

#### 3.1 New Page Structure
Transform `/projects/{projectId}/schedule` into a full call sheet builder:
```
/src/app/projects/[projectId]/schedule/
├── page.tsx (main container)
├── components/
│   ├── CallSheetBuilder.tsx (main component)
│   ├── LayoutPanel.tsx (left sidebar - section outline)
│   ├── EditorPanel.tsx (context-sensitive editor)
│   ├── PreviewPanel.tsx (live preview)
│   ├── TopBar.tsx (date selector, publish button, settings)
│   └── sections/
│       ├── HeaderEditor.tsx
│       ├── DayDetailsEditor.tsx
│       ├── RemindersEditor.tsx
│       ├── ScheduleEditor.tsx (existing, enhanced)
│       ├── TalentEditor.tsx
│       ├── CrewEditor.tsx
│       ├── NotesContactsEditor.tsx
│       ├── CustomBannerEditor.tsx
│       └── PageBreakEditor.tsx
```

#### 3.2 Layout Panel (Left Sidebar)
**Always Visible**: Shows the call sheet outline/structure
```tsx
interface LayoutPanelProps {
  sections: CallSheetSection[];
  activeSection: string | null;
  onSectionClick: (sectionId: string) => void;
  onSectionReorder: (sections: CallSheetSection[]) => void;
  onSectionToggle: (sectionId: string, visible: boolean) => void;
  onAddSection: (type: SectionType, afterId?: string) => void;
}

// Features:
// - Drag handles for reordering
// - Eye icon for visibility toggle (SetHero precedent confirmed —
//   `is_shown: false` + `.disabled` wrapper. Do NOT replace with a
//   text "Hide" button or a kebab menu item; the eye icon is the
//   canonical affordance. Sourced from spec-delta Item 8.)
// - Checkmark icon for enabled/disabled
// - Edit button to open section editor
// - "+" menu between sections for inserting custom banners or page breaks
// - "Hide disabled sections" toggle at bottom
```

#### 3.3 Editor Panel (Context-Sensitive)
Changes based on which section is being edited:

**Header Editor**:
- Layout preset selector (Classic, Center Logo, Multiple Logos)
- Variable selectors for left/center/right content:
  - Project Title, Company Name, Current Date, Day X of Y
  - General Crew Call, Shooting Call, Est. Wrap
  - Project Code
- Logo upload/select (Project Logo, Company Logo)
- Text formatting (font size, color, alignment, line height)
- Add Text / Add Image buttons

**Day Details Editor**:
- Three sub-tabs: "Key People & More", "Location & Notes", "Times & Weather"
- Times: Crew Call, Shooting Call, Breakfast, First Meal, Second Meal, Est. Wrap
- Meals: Duration, Count
- Locations: Production Office, Nearest Hospital, Parking, Basecamp
- Weather: Auto-fill button + manual override (Low/High temp, Sunrise/Sunset)
- "Shift All Times" utility button

**Schedule Editor** (enhance existing):
- Add "Unit/Lane" selector for multi-unit support
- Show durations toggle
- Cascade time changes toggle
- Scene number, Set/Description columns
- Better note handling
- Row type indicators (flag icon for production notes, star for talent calls)

**Talent Editor**:
- List talent assigned to project
- For each: Call Time, Set Time, Wrap Time, Status, Transportation, Notes
- Color coding per talent
- "Add Talent" from project assets
- "+Add Precall" option

**Crew Editor**:
- Grouped by department
- "Copy precalls from" dropdown (select previous call sheet)
- Show emails toggle, Show phone numbers toggle
- Show layout options link
- Per crew member: Call Time, Early/Delay indicator, "+Add Precall"
- "Add Crew" from project assets

#### 3.4 Preview Panel (Right Side)
- Live-updating preview of call sheet
- Zoom controls (-, %, +, Reset)
- Refresh preview button
- Show mobile toggle
- Full screen button
- Page break indicators
- Click sections to navigate to editor

---

### PHASE 4: Multi-Lane/Multi-Unit Schedule (Week 5)

This is your unique requirement that SetHero doesn't support.

#### 4.1 Data Model Enhancement
```typescript
interface ScheduleEntry {
  // ... existing fields ...
  lane: number;
  unit: 'Main' | 'Motion' | 'Stills' | 'B-Camera' | string;
}

interface ScheduleDay {
  // ... existing fields ...
  lanes: LaneConfig[];
}

interface LaneConfig {
  id: number;
  name: string;
  color: string;
}
```

#### 4.2 Schedule View Options
**Option A: Stacked Lanes**
- Show all lanes vertically stacked
- Color-coded by lane
- Visual separator between lanes

**Option B: Parallel Columns**
- Time column on left
- Each lane gets its own column
- Entries align by time

**Option C: Hybrid View**
- Call sheet summary shows condensed info per shot
- Detailed shot breakdowns on separate pages
- Cross-reference numbers between summary and detail

#### 4.3 Shot Detail Pages (Call Sheet Appendix)
For complex multi-unit days:
```
Main Schedule (Summary View):
| Time | Shot | Brief Description | Unit | Location |
|------|------|-------------------|------|----------|

Detailed Shot Breakdown (Appendix):
Each shot gets a card with:
- Shot number (matching summary)
- Full description
- Talent involved
- Products featured
- Detailed notes
- Reference images (optional)
- Equipment notes
```

---

### PHASE 5: Polish & Publishing (Week 6)

#### 5.1 Call Sheet Settings Panel
Accessible via gear icon or "Settings" tab:
- Page Size (Auto, Letter, A4)
- Spacing (Compact, Normal, Relaxed)
- Footer Logo toggle
- Time Format (12-hour, 24-hour)
- Temperature Format (Celsius, Fahrenheit)
- Colors (Primary, Accent, Text colors)
- Save as preset / Load preset

#### 5.2 Publish/Export Flow
- "Go to Publish" button
- Preview mode vs Edit mode toggle
- Generate PDF
- Send via email (with recipient list from crew)
- Live preview URL (shareable link) — reuse the existing token-based share
  pattern from `shotShares` (Sprint S21) and `castingShares` (Sprint S24). The
  call sheet share is a root-level `callSheetShares/{shareToken}` collection
  with a denormalized `resolvedSheet` so the public reader never touches
  protected collections. Sourced from spec-delta Item 11.
- Version history

#### 5.3 File Attachments
- Attach files to call sheet (maps, parking info, COVID protocols, etc.)
- Display as downloadable links in published version

---

## 📁 FILE STRUCTURE
```
src/
├── types/
│   ├── callsheet.ts (NEW)
│   ├── crew.ts (NEW)
│   └── departments.ts (NEW)
├── hooks/
│   ├── useDepartments.ts (NEW)
│   ├── useOrganizationCrew.ts (NEW)
│   ├── useProjectCrew.ts (NEW)
│   ├── useCallSheetConfig.ts (NEW)
│   └── useDayDetails.ts (NEW)
├── components/
│   ├── callsheet/ (NEW directory)
│   │   ├── CallSheetBuilder.tsx
│   │   ├── LayoutPanel.tsx
│   │   ├── EditorPanel.tsx
│   │   ├── PreviewPanel.tsx
│   │   ├── TopBar.tsx
│   │   └── sections/
│   │       ├── HeaderEditor.tsx
│   │       ├── DayDetailsEditor.tsx
│   │       ├── RemindersEditor.tsx
│   │       ├── ScheduleEditor.tsx
│   │       ├── TalentEditor.tsx
│   │       ├── CrewEditor.tsx
│   │       ├── NotesContactsEditor.tsx
│   │       ├── CustomBannerEditor.tsx
│   │       └── PageBreakEditor.tsx
│   ├── departments/ (NEW directory)
│   │   ├── DepartmentList.tsx
│   │   ├── DepartmentCard.tsx
│   │   ├── PositionList.tsx
│   │   └── DepartmentDialog.tsx
│   └── crew/ (NEW directory)
│       ├── CrewLibraryPage.tsx
│       ├── CrewMemberCard.tsx
│       ├── CrewMemberDialog.tsx
│       └── CrewTable.tsx
├── app/
│   ├── admin/
│   │   └── departments/
│   │       └── page.tsx (NEW)
│   ├── library/
│   │   └── crew/
│   │       └── page.tsx (NEW)
│   └── projects/
│       └── [projectId]/
│           ├── assets/
│           │   └── page.tsx (UPDATE - add crew section)
│           └── schedule/
│               └── page.tsx (MAJOR REFACTOR)
└── lib/
    └── callsheet/
        ├── defaults.ts (default departments, presets)
        ├── pdf-generator.ts (NEW)
        └── weather-api.ts (NEW - optional)
```

---

## 🎯 PRIORITY ORDER FOR IMPLEMENTATION

### Must Have (MVP)
1. ✅ Departments management page
2. ✅ Crew library (organization-wide)
3. ✅ Project crew assignments
4. ✅ Call sheet builder layout (section outline panel)
5. ✅ Day Details editor (times, locations)
6. ✅ Talent call times on call sheet
7. ✅ Crew call times on call sheet
8. ✅ Basic preview panel
9. ✅ Section visibility toggles
10. ✅ Section reordering

### Should Have
1. Header customization (logos, layout presets)
2. Custom banners between sections
3. Page breaks
4. Reminders/notes section
5. Weather auto-fill (API integration)
6. PDF export

### Nice to Have
1. Multi-lane/multi-unit views
2. Shot detail appendix pages
3. Live preview URL sharing
4. Email distribution
5. Version history
6. File attachments

---

## 🔗 REFERENCE: SetHero Feature Mapping

| SetHero Feature | Shot Builder Equivalent | Implementation Notes |
|----------------|------------------------|---------------------|
| Departments | NEW: /admin/departments | Hierarchical dept/position |
| All People | Library > Crew (NEW) | Organization-wide crew database |
| Locations | Library > Locations ✅ | Already exists |
| Scenes | N/A | Not needed for commercial |
| Call Sheet Builder | Schedule page (REFACTOR) | Main enhancement |
| Header | NEW section | Variable-based, customizable |
| Day Details | NEW section | Times, meals, weather |
| Today's Schedule | Existing (ENHANCE) | Add multi-lane support |
| Talent | Existing (ENHANCE) | Add call times, status |
| Crew | NEW section | By department, call times |
| Page Breaks | NEW feature | Between sections |
| Custom Banners | NEW feature | Insertable anywhere |
| Live Preview | Existing (ENHANCE) | Add zoom, mobile view |
| Publish | NEW feature | PDF, email, share link |

---

## 💡 IMPLEMENTATION TIPS

### State Management

Per `CLAUDE.md` §5 (State Strategy), server state for the call sheet builder is Firestore `onSnapshot` subscriptions — **no Redux, no Zustand, no client-side cache, no custom sync engine**. Section edits flow through per-field `updateDoc` writes (dirty-field only). Re-renders are driven by snapshot observers, not a client-side store. UI-only state (which section is being edited, expanded / collapsed state of the outline sidebar, unsaved-draft flags) lives in component-local `useState` or a minimal context provider — never mirrors Firestore documents.

Optimistic updates are permitted only for idempotent toggles (section visibility, `is_visible`, `is_key_contact`); optimistic **entity creation** (new section, new crew assignment) is explicitly disallowed and must await Firestore write confirmation per `CLAUDE.md` §5. The dual-PUT pattern SetHero uses on visibility writes (per the `sethero-callsheet-editor` research) maps to writing a structured Firestore document — the section shape and subcollection layout follows the existing `schedules/{scheduleId}/callSheet` / `schedules/{scheduleId}/crewCalls` / `schedules/{scheduleId}/talentCalls` paths already present in the codebase.

An earlier draft of this spec suggested Zustand or React Context for a `CallSheetBuilderState` store — **that suggestion is rejected**; it contradicts the hard architectural rule in `CLAUDE.md` §5. Sourced from `outputs/sethero-callsheet-spec-delta.md` Item 1.

### Autosave semantics

Call sheet field edits save on blur (input leaves focus) via dirty-field `updateDoc` writes to Firestore. Re-renders flow through `onSnapshot` subscribers per `CLAUDE.md` §5. Three rules govern the save path:

1. **Idempotent toggles** (section visibility, `is_visible`, `is_key_contact`, `showName` / `showPhone` on locations) apply optimistically client-side and converge on the next snapshot tick. These never need a confirmation gesture; the toggle IS the confirmation.
2. **Free-text and numeric fields** save on blur via dirty-field `updateDoc`. No debounce on text input — only the on-blur write is dispatched. The user's draft state lives in component-local `useState`; the snapshot listener is the single source of truth and re-syncs after the write lands.
3. **Destructive actions** (section hide, row delete, section reorder, location remove, track collapse, timeline entry delete) require an explicit confirmation OR a 5-second `sonner` undo toast (the `destructiveActionWithUndo` helper in `src-vnext/shared/lib/`). The undo window prevents the silent-loss hazard SetHero exhibits with its fail-silent autosave.

Every section header renders an unobtrusive "Saved Xs ago" pill (green dot + relative timestamp, ticking every ~5 seconds) so the producer never has to wonder whether their last keystroke landed. Implementation lives in `src-vnext/shared/components/SaveIndicator.tsx` and a sibling `useLastSaved` hook.

There is **no client-side cache layer**, **no custom sync engine**, **no offline mutation queue**. Firestore's default IndexedDB persistence handles offline reads; a failed write surfaces a `sonner` error toast and the user re-tries manually. This is the deliberate inverse of SetHero's "PUT and forget" pattern, which loses changes silently when the network drops mid-edit.

Sourced from `outputs/sethero-callsheet-spec-delta.md` Item 6 (corrected: the spec delta originally referenced `react-hot-toast`; the codebase uses `sonner`, which has native action-button support and is the established toast layer).

### Drag and Drop
Use `@dnd-kit/core` for:
- Section reordering in layout panel
- Schedule entry reordering
- Department reordering

### PDF Generation
Consider `@react-pdf/renderer` or `html2pdf.js` for export:
- Render call sheet preview as PDF
- Handle page breaks properly
- Include all sections based on visibility

### Real-time Preview
- Debounce preview updates (300ms)
- Use React's useDeferredValue for smooth updates
- Consider iframe for isolated preview rendering

---

## 📝 NOTES FOR CLAUDE CODE

1. **Start with data models** - Create all TypeScript types first
2. **Build hooks before UI** - Get Firebase integration working
3. **Incremental enhancement** - Don't break existing schedule functionality
4. **Test with real data** - Use existing projects for testing
5. **Mobile consideration** - Preview panel should work on mobile
6. **Accessibility** - Ensure drag-drop has keyboard alternatives
7. **Error handling** - Firebase operations should have proper error states

When in doubt, reference SetHero's implementation but prioritize:
- Cleaner UI (less cluttered)
- Better UX for fashion/commercial shoots
- Multi-unit support (unique feature)
- Integration with existing products/talent/shots system
Summary
This specification document covers everything needed to transform your Shot Builder's schedule page into a full call sheet builder comparable to SetHero, with the added benefit of multi-lane/multi-unit support.
Key additions you'll need:

Departments & Positions - Hierarchical organization of crew roles
Crew Library - Organization-wide crew database (like your existing Talent library)
Project Crew Assignments - Like your existing Assets page but for crew
Call Sheet Builder UI - The main refactor with Layout Panel + Editor Panel + Preview
Day Details - Call times, meals, weather, key locations
Publishing - PDF export, sharing, email distribution

Save this as CALL_SHEET_BUILDER_SPEC.md in your project root, and Claude Code can reference it throughout the implementation process. The phased approach allows for incremental progress while maintaining a working app.
