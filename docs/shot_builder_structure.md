<!--- Shot Builder App Structure

This document outlines the high‑level structure of the Shot Builder
application.  It covers entity relationships, database collections,
UI navigation and component hierarchy.  The goal is to provide
GPT‑5 Codex with a mental model of how the pieces fit together without
locking it into specific implementation details.  -->

# 🧱 App Structure & Data Model

## 1 Entities & Relationships

The Shot Builder domain centres on a handful of core entity types and
relationships.  Understanding these relationships is key to designing
Firestore collections and the React component tree.

| Entity | Description | Relationships |
| --- | --- | --- |
| **Project** | Represents a campaign or shoot. Contains metadata (name, description, thumbnail, start/end dates) and multiple **shoot days**. | Has many **shots**; each project has its own members/roles (subset of users). |
| **Shot** | A unit of work representing a specific scene/pose to capture. Contains name, description, date (optionally null), location, talent, attached products, custom fields and status. | Belongs to a **project** (may be unassigned); references one **location** (optional) and many **talent** and **products**. |
| **Product Family** | The parent record for a garment. Contains common metadata (name, description, image) and references multiple **SKUs**. | Has many **product SKUs**. |
| **Product SKU** | Specific colour and size of a product. Contains size, colour, style number and inventory status. | Belongs to a **product family**; used in shots and pulls. |
| **Talent** | A model or participant. Contains personal info (name, gender, agency details), sizes and custom notes. | May be attached to many **shots**. |
| **Location** | A shooting location. Contains name, address, images and custom fields. | May be attached to many **shots**. |
| **Pull** | A list of product SKUs, quantities and sizes required for a project/date. Includes status (pending, fulfilled, substituted) and comments. | Belongs to a **project** and optionally to a specific **shoot day**; references many **product SKUs**. |
| **User** | An authenticated person with a role. Contains profile info, permissions and membership in projects. | Can be an admin, producer, crew, warehouse user or viewer. |

## 2 Firestore Data Model

Firestore collections should be structured to reflect the multi‑project
nature of the app while enforcing organisation boundaries.  The
starter kit already models shots, product families, projects and
reservations【261360160490396†L2-L24】.  A recommended schema is:

* `/projects/{projectId}` – stores project metadata and an access map
  (uid → role).  Each project document may have subcollections:

  * `/projects/{projectId}/shootDays/{dayId}` – documents for each
    planned shooting day (date, notes).
  * `/projects/{projectId}/shots/{shotId}` – shot documents belonging
    to the project.  Each shot references a location, an array of
    talent IDs, an array of SKU IDs and an object of custom fields.
  * `/projects/{projectId}/pulls/{pullId}` – pull lists for each
    project/date.  Each pull item references a SKU and holds
    requested quantity, assigned size, status and comments.

* `/productFamilies/{familyId}` – top‑level collection for product
  families.  Contains common fields (name, description, default
  image).  A subcollection `/productFamilies/{familyId}/skus/{skuId}`
  stores variant data (colour, size, style number, status).

* `/talent/{talentId}` – stores talent profiles.  Fields include
  personal info, agency contact details, size information and custom
  metadata.

* `/locations/{locationId}` – stores location details.  Fields
  include name, address, images and custom fields.

* `/users/{uid}` – stores user profile and global role (admin,
  producer, etc.).  Project‑level roles live in the `access map` of
  each project document, not here.

This structure leverages Firestore’s hierarchical documents and
collections to isolate project data.  Role‑based rules can restrict
access at the project subcollection level, ensuring crew only see
projects they belong to【209387305302324†L1422-L1436】.

## 3 UI Navigation & Component Hierarchy

### 3.1 Navigation

The app uses a **sidebar** as the primary navigation element.  Top
sections correspond to root routes: **Dashboard**, **Shots**,
**Products**, **Talent**, **Locations**, **Pulls**, **Admin**.  Each
section may display sub‑navigation (tabs) within the page.

### 3.2 Page Components

1. **DashboardPage** – displays a grid of **ProjectCard** components
   and a **NewProjectModal**.  Uses a sidebar for navigation and a top
   bar with search and quick actions.
2. **ShotsPlannerPage** – contains a **ShotsFilterBar**, **ShotList
   View**, **KanbanView** (future) and a **NewShotModal**.  The list
   view uses a table component (**ShotRow**) with sortable columns.
3. **ProductsPage** – shows products in list/grid/kanban views.  Each
   **ProductCard** displays the family image and name; clicking
   reveals SKUs.  A **NewProductModal** enables creation.
4. **TalentPage** – similar structure to ProductsPage but with
   **TalentCard** components and a **NewTalentModal**.
5. **LocationsPage** – displays **LocationCard** components and
   **NewLocationModal**.
6. **PullsPage** – lists pull requests.  A **NewPullModal** lets
   users select a project/date and generates an aggregated list of
   SKUs.  A **PullTable** shows requested items with actions for
   warehouse users.
7. **AdminPage** – shows **UserTable** with invite/edit/delete
   actions.  Contains forms to assign roles and project memberships.

### 3.3 Component Patterns

* **Modal components** are used for creation/edit flows.  Each modal
  should be self‑contained, manage its own form state and call back
  into a parent context on save/cancel.
* **Context providers** supply global data such as the current user,
  selected project, or flags.  The starter kit already includes an
  auth context and flag context【18543939969052†L24-L33】.
* **Reusable form inputs** (text fields, dropdowns, multi‑select,
  image upload, date picker) should be shared across modals to ensure
  consistency.

## 4 Routing & State Management

* Use **react‑router v6** for routing.  Define top‑level routes for
  each page and nested routes for per‑project views.  Protect routes
  with `RequireAuthRoute` and `ProtectedLayout` as described in the
  repository’s agent guide【18543939969052†L97-L104】.
* Use **React context** for authentication, current project and
  feature flags.  Use **hooks** and local component state for form
  management.  Avoid global state libraries unless complexity demands
  it.

## 5 Data Flow & Sync

* **Client‑side data fetching** – components subscribe to Firestore
  documents/collections using Firebase’s web SDK.  Use converter
  functions to map Firestore data into TypeScript interfaces.
* **Server‑side logic** – long‑running tasks (CSV import, PDF
  generation, nightly backups) should be implemented as Cloud
  Functions.  The repository already includes stubs for these tasks
  and nightly snapshotting【261360160490396†L23-L24】.
* **Role enforcement** – Firestore security rules must check both the
  user’s global role and their role within a project.  Example rules
  for role‑based access control are provided in Firebase’s
  documentation【209387305302324†L1422-L1436】.

By following this structural outline, the agent can implement new
features consistently within the existing architecture and avoid
cross‑cutting changes that would derail the one‑day MVP.
