# SetHero Call Sheet Builder — Comprehensive Analysis

**Source:** https://my.sethero.com/portal/25644/
**Analyzed:** 2026-04-01
**Status:** Complete — every visible feature documented from live exploration

---

## 1. Platform Overview

SetHero is a dedicated call sheet and production management platform for film, TV, and commercial production. It's purpose-built around the call sheet workflow — unlike generic project tools, every feature feeds into generating professional call sheets.

### Navigation Structure
- **Dashboard** — project setup progress + summary cards (People, Scenes, Crew, Talent, Locations, Callsheets)
- **Call Sheets** — schedule timeline + call sheet management
- **All People** — combined crew + talent directory
- **Scenes** — scene/shot breakdown
- **Locations** — location management
- **Departments** — department configuration
- **Settings** — project settings
- **Admins** — user management

### Multi-Tenant Hierarchy
Breadcrumb: All Companies → Immediate Group → Project → Page
Supports company-level grouping of projects.

---

## 2. Schedule & Call Sheet Management

### 2.1 Schedule Timeline
The Call Sheets page shows a **timeline view**:
- **"Main Schedule"** header with dropdown (supports multiple schedules per project)
- Numbered shoot days (1, 2, ...) connected by a vertical red timeline
- Each day shows:
  - **Shooting Date** (Mon, Sep 22)
  - **Call Sheets** column (Edit button or "Add Call Sheet")
  - **Production Reports** column ("Add PR" button)
  - Delete button (×)
- **"+"** button to add more days
- **Insert Day Before** and **Insert Off Day** options on each day

### 2.2 Multi-Schedule Support
The "Main Schedule" dropdown suggests projects can have multiple independent schedules (e.g., main unit, second unit).

---

## 3. Call Sheet Editor (The Core)

### 3.1 Architecture
The editor uses a **section-based outline + live preview** pattern:
- **Left panel**: Section outline (editable structure)
- **Right panel**: Live WYSIWYG preview of the call sheet
- **Top bar**: Schedule navigation, publish status, export controls

### 3.2 Top Bar
- **Schedule nav**: "< Main Schedule | Sep 22 (Mon) >" — navigate between days
- **Status**: "● Editing Call Sheet" (red dot) + "Publish" button
- **"Go to Publish"** button (prominent green, right side)
- **Actions**: Three-dot menu, Download (PDF), Refresh
- **Auto-save**: "Last saved a few seconds ago"

### 3.3 Section Outline (Left Panel)
Three tabs: **Outline** | **Settings** | **File Attach**

**Layout** section with **"Load / Save"** button for layout templates.

**Sections** (each with icon, drag handle, edit button, toggle):
| Section | Icon | Purpose |
|---------|------|---------|
| **Header** | (edit pencil) | Project name, company, crew call time, date, day number |
| **Day Details** | ⏰ clock | Key People, Production Office, Nearest Hospital, weather, call times, sunrise/sunset |
| **Reminders** | 🔔 bell | Custom reminder notes |
| **Today's Schedule** | □ schedule | Time-based scene schedule table |
| **Clients** | 🏢 building | Client/brand information |
| **Talent** | ★ star | Cast/talent call times and assignments |
| **Extras and Dept. Notes** | 👥 people | Background talent + department-specific notes |
| **Advanced Schedule** | □ schedule | Extended schedule details |
| **--- PAGE BREAK ---** | dashed line | Manual page break insertion |
| **Crew** | 👥 grid | Department-grouped crew roster |
| **Notes & Contacts** | ✏️ pencil | General notes + emergency contacts |
| **Quote of the Day** | " " quotes | Motivational quote for morale |

### 3.4 Section Editing
Each section is a **standalone editor** accessed by clicking it in the outline.

**Talent Section Example:**
- Section header with toggle (on/off), dropdown menu, "Edit Fields" button, "Done" button
- Content area: Add talent from database, empty state with CTA
- **Smart suggestions**: "1 new talent found tagged in the scene schedule" with "Add all to callsheet" action
- Per-talent data entry: role, call time, status, transport, etc.

### 3.5 Field Customization ("Edit section" Modal)
**Section Title**: editable text field
**"Reset all to default"** button

**Per-field controls:**
| Control | Description |
|---------|-------------|
| **Drag handle** (⠿) | Reorder columns |
| **Field name** | Editable label (rename columns) |
| **Width selector** | X Small / Small / Medium / Large |
| **Toggle** | Show/hide the column |
| **Original name** | Reference to default name |
| **Reset** | Restore individual field to default |

**Talent section fields (10):**
ID, Talent, Role, Status, Transpo, Call, BLK/RHS, MU/WARD, Set, Remarks

This is **per-section, per-field customization** — the same granularity Saturation has for budget columns but applied to every call sheet section.

---

## 4. Live Preview

### 4.1 Preview Controls
- **"Live preview:"** label with external link (shareable preview URL)
- **Zoom**: In/Out buttons + percentage (100%)
- **"Show mobile"** checkbox — toggle mobile view
- **"Refresh preview"** button
- **"Full Screen"** button — maximize preview

### 4.2 Call Sheet Content (Page 1)

**Header Block:**
- Project name (large, left-aligned)
- Company name (below project)
- **Crew Call time** — prominent circular clock widget (e.g., "7:00 PM")
- Date: "Monday, September 22, 2025"
- Day indicator: "Day 1 of 2"

**Day Details Block:**
- **Key People** — placeholder for director, producer, etc.
- **Production Office** — name + full address
- **Nearest Hospital** — with map pin icon
- **Call times** (right column): Breakfast, Crew Call, Shooting Call, First Meal, Est. Wrap — each with clock icon + time
- **Weather** — temperature (low/high), weather icon, text forecast, wind speed/direction
- **Sunrise/Sunset** times
- **Notes** — placeholder text area
- **Set Medic**, **Script Version**, **Schedule Version** — placeholder fields

**Today's Schedule:**
- Dropdown label ("Today's Schedule ▼")
- Table columns: TIME | SET / DESCRIPTION | CAST | NOTES | LOCATION
- Scene entries with time, duration, scene details, cast numbers, notes, location address

**Talent Section:**
- Table: ID | TALENT | ROLE | STATUS | TRANSPO | CALL | BLK/RHS | MU/WARD | SET | REMARKS

### 4.3 Multi-Page Support
- **PAGE BREAK** element in outline for explicit page breaks
- Page 2 typically contains: Crew roster, Notes & Contacts, Quote of the Day

---

## 5. Publish & Distribution Flow

### 5.1 Publish Status
- Call sheets have draft/published states
- "● Editing Call Sheet" indicator with "Publish" button
- "Go to Publish" prominent green button (top right)

### 5.2 Export
- **Download** button (PDF icon in top bar)
- **Shareable preview URL** (external link icon next to "Live preview:")
- The preview URL format: `https://cs.sethero.com/preview/{hash}`

### 5.3 File Attachments
- **"File Attach"** tab in the editor — attach supporting documents to the call sheet

---

## 6. Layout Templates

### 6.1 Load / Save
- **"Load / Save"** button in the Layout section
- Save current section arrangement as a reusable template
- Load previously saved layouts

This means you can create different call sheet layouts (e.g., "Standard Shoot", "Studio Day", "Location Day") and reapply them.

---

## 7. Weather Integration

SetHero automatically pulls weather data for the shoot location and date:
- Temperature (low/high in °C or °F)
- Weather icon (clouds, sun, rain)
- Text description: "Clear conditions throughout the day with a chance of rain throughout the day."
- Wind speed and direction
- Sunrise and sunset times

This is a **standout feature** — production teams need weather for outdoor shoots, and having it auto-populated eliminates a manual step.

---

## 8. Production Reports

Beyond call sheets, SetHero supports **Production Reports** (PR):
- Each shoot day can have a production report
- "Add PR" button on each day in the schedule
- Production reports track what actually happened vs. what was planned

---

## 9. Key Differentiators vs Our Call Sheet Builder

| Feature | SetHero | Production Hub (Current) |
|---------|---------|------------------------|
| Section-based outline | Yes (12 section types) | Yes (tracks/sections) |
| Section toggles (on/off) | Yes | No |
| Section reorder (drag) | Yes | Limited |
| Per-section field customization | Yes (rename, resize, reorder, toggle columns) | No |
| Column width control | Yes (X Small/Small/Medium/Large) | No |
| Live WYSIWYG preview | Yes (with zoom, mobile toggle, fullscreen) | Yes (basic) |
| Weather integration | Yes (auto from location+date) | No |
| Smart suggestions | Yes (auto-detect talent from scenes) | No |
| Layout templates (save/load) | Yes | No |
| Publish/draft flow | Yes (status indicator, Go to Publish) | No (direct print) |
| Shareable preview URL | Yes | No (separate share system) |
| Mobile preview toggle | Yes (checkbox) | No |
| Page breaks | Yes (explicit in outline) | Yes (dept page breaks) |
| Production reports | Yes (separate PR per day) | No |
| File attachments | Yes (per call sheet) | No |
| Multi-schedule support | Yes | Yes (multiple schedules) |
| Crew call time widget | Yes (prominent circular clock) | No (text only) |
| Quote of the Day | Yes | No |
| Auto-save | Yes ("Last saved...") | Yes |

---

## 10. Applicable Learnings for Production Hub

### Must-Have (directly applicable):
1. **Section toggle system** — let users show/hide any call sheet section
2. **Per-section field customization** — rename, reorder, resize, toggle columns in each section
3. **Layout templates** — save and load call sheet layouts for reuse
4. **Mobile preview toggle** — preview how the call sheet looks on mobile
5. **Crew call time widget** — prominent visual clock element instead of plain text
6. **Smart suggestions** — auto-detect talent/crew from schedule entries and suggest adding

### Should-Have:
7. **Weather integration** — auto-populate weather for shoot location + date
8. **Publish/draft flow** — explicit publishing step with status indicator
9. **Shareable preview URL** — dedicated preview link for stakeholders
10. **File attachments** — attach supporting docs to call sheets
11. **Production reports** — post-shoot day summary (what actually happened)

### Nice-to-Have:
12. **Fullscreen preview** — maximize the preview for review sessions
13. **Quote of the Day** — morale section
14. **Column width control** (X Small/Medium/Large) per field

---

## 11. Implementation Priority for Production Hub

### Phase 1 (Call Sheet Foundation Improvements):
- Section toggle system (show/hide each section)
- Section reorder (drag-and-drop in outline)
- Layout save/load (persist call sheet configurations)

### Phase 2 (Field Customization):
- Edit Section modal (rename, reorder, resize, toggle columns)
- Mobile preview toggle
- Crew call time widget upgrade

### Phase 3 (Distribution):
- Publish/draft status flow
- Shareable preview URL
- File attachments

### Phase 4 (Intelligence):
- Weather integration API
- Smart talent/crew suggestions from schedule
- Production reports per shoot day

---

*This document captures every visible feature from live exploration of SetHero's call sheet builder. No features were omitted.*
