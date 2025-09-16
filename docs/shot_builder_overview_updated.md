<!--- Shot Builder App Overview

This document provides a concise summary of the purpose, goals and major
features for the **Shot Builder** application.  The app is envisioned as
an end‑to‑end tool to help plan commercial photo/video shoots, organize
wardrobe and talent, and coordinate logistics with warehouse and crew
teams.  Throughout the overview you’ll see notes challenging
assumptions, offering alternative perspectives, and linking back to
relevant information from the existing repository or authoritative
sources.  Citations are provided in footnotes.  -->

# 📸 Shot Builder App – Overview

## Purpose & Goals

The Shot Builder application aims to streamline the planning and
execution of Unbound Merino’s photography and video shoots.  At a high
level it should enable a producer to:

* **Create and manage projects** that represent a campaign or shoot.
* **Plan shot lists and schedules**, assign them to shooting days and
  locations, and attach relevant products and talent.
* **Maintain a structured wardrobe database** of products, variants,
  sizes and colours, along with a talent and location catalogue.
* **Generate pull sheets** for the warehouse and manage fulfilment
  status.
* **Export shot lists and pull sheets** to PDF or spreadsheet formats
  for distribution.
* **Control user access** with role‑based permissions so producers,
  crew, warehouse staff and view‑only stakeholders can collaborate
  without compromising security.

The existing repository already provides a **React + Vite + Tailwind
starter kit** with Firebase integration, authentication (Google sign‑in
by default) and role‑based access control【261360160490396†L2-L24】.  It
supports multiple projects, a create/edit shot page, a day planner
view, a pull‑sheet aggregation model and security rules【261360160490396†L2-L24】.
Our plan should build on these foundations rather than reinventing them.

## Target Audience & Use Cases

The primary users include:

| Role | Description & Needs |
| --- | --- |
| **Admin/Owner** | Owns the application and projects; needs to invite users, define access levels, approve new accounts and maintain revision history. |
| **Producer/Moderator** | Plans shoots, creates and edits projects, shots, products, talent and locations; oversees pull lists and communicates with the warehouse. |
| **Crew Member** | Views and edits existing shot records, attaches products/talent, leaves comments and requests pull changes. |
| **Warehouse User** | Sees pull lists, fulfils requests, reports substitutions or shortages and leaves time‑stamped notes. |
| **View‑only User** | Receives read‑only links for clients or stakeholders to review projects without editing. |

Each role requires fine‑grained access control.  Firebase’s security
model supports role‑based access control (RBAC) through custom claims
and Firestore rules【209387305302324†L1422-L1436】.  Use of RBAC should
be part of the non‑functional design.

## Scope & Non‑Goals

The **scope** of the MVP is intentionally narrow to achieve a usable
product within one day.  It includes authentication (Google sign‑in and
basic email/password sign‑up), a dashboard, project creation, basic
shot/talent/product management, and warehouse pull sheets.  More
advanced features—such as magic link sign‑in, automatic URL previews
(similar to Notion), integrated Google Maps for locations, full
revision history, detailed analytics, or an e‑commerce‑style product
browser—are desirable but should be scheduled for later phases (see
Phase 7 in the roadmap).

**Non‑goals** for the first release:

* Server‑side rendering or mobile apps.  The existing starter kit is
  client‑side React and can be enhanced gradually【18543939969052†L24-L33】.
* Multi‑tenant models beyond per‑project scoping【18543939969052†L24-L33】.
* Real‑time chat.  The warehouse/producer interactions can be
  implemented via status updates and comments rather than a full chat
  system.
* Advanced integrations like magic links, Notion‑style previews,
  Google Maps and analytics.  These belong to Phase 2 enhancements and
  should not delay the MVP.

## Key Features & Desired Functionality

Below is a high‑level summary of the requested features.  In places we
challenge assumptions, suggest incremental improvements or raise
potential issues for the GPT‑5 Codex agent to consider.

### Authentication & Sign‑Up

* **Google sign‑in** (already in the starter kit) should remain
  the default login method【261360160490396†L2-L24】.  Implement **email
  sign‑up** as part of the MVP.  **Magic link** sign‑in is deferred to
  Phase 2 (see roadmap) due to additional complexity.  **Assumption to
  challenge:** do you actually need all three methods on day 1?

### Dashboard (Welcome Page)

* Replace the top navigation with a **sidebar** for scalability.  The
  dashboard should list **projects** as visual cards with name,
  description, optional thumbnail and next shoot date.  Provide
  **actions** (open, rename, archive, delete) via a context menu.
* A **new project** button opens a modal for entering project name,
  description/notes, URL (optional), shoot dates (one or multiple) and
  an image.  Use progressive enhancement: initially require only the
  name and dates; preview URL embeddings can be added later in Phase 2.

### Shots & Planner

* Consolidate the existing **Shots** and **Planner** pages into a
  unified module with multiple views (List, Gallery, Kanban) and
  filters by project or unassigned shots.  Shots should be assignable
  either to a project as a whole or to a specific shoot date within a
  project.
* A **create shot** modal should capture at minimum: shot name,
  description, project/date assignment, location (select or create),
  talent (optional multi‑select), and attachments.  The critical
  feature is product selection: implement a search/autocomplete
  component similar to Unbound Merino’s web shop.  **Assumption to
  question:** requiring a Notion‑style URL preview or full category
  navigation may slow down day‑1 delivery and is deferred.
* Shots must support **custom fields** (text, dropdowns, multi‑select,
  image upload, URL) so producers can adapt the app to changing
  requirements.  Provide a UI for defining these fields at the project
  level to avoid cluttering the base schema.

### Products & Import

* Merge product management and import into a single **Products** page
  with multiple views (List/Grid/Kanban) and batch edit support.  The
  concept of **product families** and SKU variants in the starter kit
  should be preserved【261360160490396†L14-L18】.  **Size and colour** are
  attributes of a SKU; images and description belong to the family.
* Provide a **New Product** modal with fields for name, style number
  and category; after creating, allow adding multiple colours and
  sizes in a table.  Uploading images for each colour is optional.
* CSV import/export is slated for Phase 6 in the roadmap.  Begin with
  in‑app creation and leave bulk import/export for later.

### Talent & Locations

* The **Talent** page should display model cards with pictures and
  metadata (name, gender, agency info, optional notes).  Provide
  filters for gender, agency and custom categories.  A **create
  talent** modal should collect contact details, profile URL and
  images.  **Assumption to question:** storing personal data (agent’s
  phone/email) requires compliance with privacy laws; ensure the
  privacy policy and consent forms are addressed.
* The **Locations** page should mirror the talent page: cards with
  name, address and photos, and a create modal.  Google Maps
  integration for address auto‑complete is part of Phase 2 and can be
  deferred.

### Pulls & Warehouse Fulfilment

* A **Pulls** section allows producers to generate lists of products
  needed for a shoot.  Users can generate a pull from a project’s
  shot list or start from scratch.  The system must aggregate
  products and count how many times each appears in the shot list.
* Producers specify sizes and quantities, can remove or add items,
  and publish the pull to the warehouse.  Warehouse staff can mark
  items as fulfilled or propose substitutions (with comments).  A
  flagged section should show items present in shots but not included
  in the pull.

### Exports

* Provide export functions to **PDF** and **spreadsheet** formats
  (CSV/XLSX/Google Sheets).  Allow selection of columns, page
  layout/breaks, header images, notes and custom branding.  Use
  server‑side PDF generation via Cloud Functions; local exports can
  rely on browser print for the MVP.

### Admin Panel & User Access

* Use Firebase custom claims and Firestore rules to implement roles
  (admin, producer, crew, warehouse, view‑only)【209387305302324†L1422-L1436】.
  Provide a UI to invite users, assign roles and grant project‑level
  permissions.  Include a revision history to track and revert
  accidental edits.  For the MVP, implement soft delete and basic
  audit logs; full version history can be scheduled for Phase 2.

## Assumptions & Recommendations

To ensure the scope remains achievable, challenge these assumptions:

1. **Timeline** – building all features within a single day is
   unrealistic; prioritise the MVP focusing on login, dashboard,
   basic project/shot/product management and simple pull generation.
   Defer advanced features (magic links, Notion‑style previews,
   analytics) to Phase 2.

2. **Sign‑in methods** – limiting authentication to Google and email
   reduces complexity.  Magic links can be added later if needed.

3. **CSV import/export** – manual product creation is sufficient for
   early use.  CSV import can be delegated to a Cloud Function and
   shipped after the core UI is stable.

4. **Full offline support** – Firestore provides offline caching, but
   building an offline‑first experience is non‑trivial.  Consider this
   after the core workflow works online.

5. **Complex UI interactions** – features like drag‑and‑drop
   scheduling, Kanban boards and multi‑select tables should be
   implemented iteratively, starting with simple list views and
   filtering.

6. **Personal data storage** – talent and crew records may contain
   sensitive information.  Ensure the app complies with data
   protection laws (GDPR/Canadian privacy laws) and provides clear
   consent notices.

By questioning these assumptions and focusing on incremental delivery
for the MVP while planning advanced functionality for subsequent
phases, the project can produce a working prototype quickly and
provide a clear path for future enhancements.
