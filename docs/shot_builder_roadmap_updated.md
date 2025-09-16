<!--- Shot Builder App Roadmap

This document proposes a step‑by‑step roadmap for delivering a
minimum‑viable version of the Shot Builder app within a tight
turnaround.  It breaks the work into phases and tasks to help
prioritise features, highlight dependencies and provide GPT‑5 Codex
with clear milestones.  -->

# 🗺️ High‑Level Implementation Roadmap

The following roadmap assumes that the repository’s starter kit (React
+ Vite + Tailwind with Firebase integration) is the baseline.  The
focus is on producing a **usable MVP within one day**, followed by
iterative enhancements over the next week and medium‑term feature
additions.  Each phase lists tasks, recommends a sequence and notes
relevant guardrails.

## 🛫 Phase 0: Environment Setup (0–2 hours)

1. **Clone the repository** and check out a feature branch (`feature/mvp`).
2. **Install dependencies** using `npm ci` and copy `.env.example` to `.env`.  Populate Firebase credentials via environment variables and verify the app runs locally (`npm run dev`).
3. **Review existing code**, paying attention to `src/pages`, `src/components` and `src/lib` to understand current patterns.
4. **Plan tasks** by creating issues in GitHub (if applicable) and linking them to the branch.

## 🧩 Phase 1: Core Infrastructure (2–6 hours)

1. **Authentication** – ensure Google sign‑in works out of the box.  Add email sign‑up (username/password) if time permits.  Skip magic links for the MVP.
2. **Role handling** – implement a simple role map in Firestore (admin, producer, crew, warehouse, viewer) and set up custom claims when users are created.  Write preliminary Firestore rules to restrict access based on role【209387305302324†L1422-L1436】.
3. **Navigation layout** – convert the header nav into a sidebar component with links for Dashboard, Shots, Products, Talent, Locations, Pulls and Admin.  Use `react-router` v6 to define routes and add `RequireAuthRoute`/`ProtectedLayout` wrappers【18543939969052†L97-L104】.
4. **Project model** – create the `/projects` collection schema (id, name, description, dates, thumbnail, roles map).  Build a basic **ProjectCard** component and **NewProjectModal**.  Allow creation, editing (rename and notes) and deletion in UI.

## 🎬 Phase 2: Shots & Planner (6–12 hours)

1. **Shots list** – build a **ShotList** page showing all shots for the current project (or all unassigned).  Display columns for name, date, project and status.  Provide sorting and filtering by project/date.
2. **New shot modal** – implement a form with fields: name, description, project assignment, date (optional), location (dropdown + create new), talent (multi‑select), products (search/autocomplete) and custom fields.  Add minimal validation.
3. **Attach products** – build a `ProductSelect` component that queries the `productFamilies` collection, lists results by name and allows adding multiple SKUs with quantity/size later.  Defer advanced category browsing to a later phase.
4. **Custom fields** – implement a simple mechanism to define extra fields at the project level (e.g. a JSON schema stored under `/projects/{id}/customFields`).  Render these fields in the shot form.
5. **Planner view** (optional for MVP) – create a second tab that groups shots by shoot date.  Use drag‑and‑drop to reorder if time permits; otherwise provide a read‑only grouping.

## 👕 Phase 3: Products & Import (12–16 hours)

1. **Products page** – display product families in a grid with images and names.  Clicking a card reveals SKUs (colours and sizes).  Provide search and filters by category and status.
2. **New product modal** – implement a form with name, style number and category; after saving, allow adding colours, style numbers and sizes in a table.  Save product families under `/productFamilies/{familyId}` and SKUs under `/productFamilies/{familyId}/skus/{skuId}`.
3. **Batch actions** – support selecting multiple products for batch status changes (active/discontinued).  Defer CSV import/export to a later phase but design the data model with import/export in mind.

## 🎭 Phase 4: Talent & Locations (16–20 hours)

1. **Talent page** – render talent cards with image, name and tags.  Provide search and filters.  Build a **NewTalentModal** to collect first/last name, gender, agency details, profile URL and images.  Use subcollection or embedded objects to store custom measurements (e.g. shirt size, shoe size).
2. **Locations page** – similar to talent but storing name, address and images.  Provide a **NewLocationModal**.  Defer Google Maps auto‑complete to a later phase.
3. **Permissions** – ensure only producers and admins can create/edit talent or locations; crew can view; warehouse should have no access.

## 📦 Phase 5: Pulls & Warehouse (20–24 hours)

1. **Pull generation** – implement logic to aggregate products from shots within a project/date.  Count each SKU and present a list with columns for item, quantity, size and status.  Allow editing quantities and adding/removing items.
2. **Publishing & fulfilment** – add a status field to pulls (draft, published, in progress, fulfilled).  When a pull is published, send a notification (e.g. email or Firestore document) to warehouse users.  Warehouse users can mark items as fulfilled, propose substitutions and leave comments.
3. **Flagged items** – display a section listing SKUs that appear in shots but are not on the pull.  Allow producers to add them with one click.

## 📄 Phase 6: Exports & Basic Enhancements (Day 2–5)

1. **PDF export** – use a Cloud Function (e.g. Node.js with `pdf-lib`) to generate a printable shot list or pull sheet.  Add options for custom headers, footers and branding.
2. **Spreadsheet export** – provide CSV/XLSX downloads.  Consider integrating with Google Sheets API.
3. **CSV import** – implement a product import function triggered by file upload.  Parse the CSV, create product families and SKUs and report validation errors.  Use a Cloud Function to avoid blocking the UI.
4. **Performance & security** – audit Firestore indexes, write additional security rules and add tests to cover edge cases.  Apply best practices from Firebase docs and the AGENT_GUIDE【209387305302324†L1422-L1436】【261360160490396†L2-L24】.

## ✨ Phase 7: Phase 2 Enhancements (Day 5–10)

The following features were intentionally deferred from the MVP to keep the initial scope manageable.  They provide significant usability and productivity gains and should be scheduled after the core workflows are stable.

1. **Magic link authentication** – implement Firebase email link (magic link) sign‑in to simplify login for users who prefer not to use passwords.
2. **Notion‑style URL previews** – when a URL is attached to a project or shot, fetch metadata (title, description, OG image) via a server‑side function and render a preview card.  Cache results to minimise network calls.
3. **Google Maps integration** – integrate the Places Autocomplete API into the NewLocationModal for auto‑completing addresses and providing map previews.
4. **Kanban & drag‑and‑drop** – enhance the Shots planner with drag‑and‑drop reordering and optional Kanban boards grouped by shoot date or status.
5. **Revision history** – implement versioning on key entities (products, shots, projects) with the ability to view and revert changes.  Use Cloud Functions to snapshot documents on writes.
6. **Advanced analytics** – build dashboards summarizing product usage across shoots, talent frequency, location utilisation and other KPIs.  Consider integrating BigQuery for large‑scale analytics.
7. **Mobile responsive & offline improvements** – refine UI layouts for tablets/phones and leverage Firestore offline persistence for a better offline experience.

## ✅ Phase 8: Finalisation & Polishing

1. **Testing** – write unit and integration tests using Vitest and @testing-library/react.  Test auth redirects, role checks, form validations and data flows.  Use the Firebase emulator suite for local rule testing.
2. **Accessibility** – ensure components meet accessibility standards (ARIA labels, keyboard navigation, colour contrast).  Run audits with Lighthouse.
3. **Documentation** – update the AGENT_GUIDE and inline comments to reflect any new patterns or feature flags.  Prepare a `README_DEV.md` with setup instructions for other developers.
4. **Deploy** – set up continuous deployment via GitHub Actions and Firebase Hosting.  Use preview URLs to test before going live.

By following this phased roadmap, the GPT‑5 Codex agent can focus on one unit of work at a time, deliver a functional MVP rapidly and continue to iterate without sacrificing code quality or security.  The Phase 7 enhancements provide a roadmap for post‑MVP development, ensuring the app remains aligned with user goals.
