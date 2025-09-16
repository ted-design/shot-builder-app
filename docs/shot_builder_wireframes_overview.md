<!--- Shot Builder Wireframes Overview

This document accompanies the wireframe images created for the Shot Builder
application.  Each section briefly describes the purpose of the screen
and how users will interact with it.  The images embedded here are
low‑fidelity sketches intended to communicate layout and content;
they are not final designs.  The agent should treat these as
suggestions and refine them during implementation.  -->

# 🖼️ Wireframe Overview

## Login

![Login wireframe]({{file:file-YUHiKtK6mBJAroYrvetw91}})

The login page centres a card containing options to sign in with
Google (default), email/password and a magic link.  Only Google and
email are required for the MVP.  Links for creating an account or
resetting a password sit below the buttons.

## Dashboard / Welcome

![Dashboard wireframe]({{file:file-S8wCvZEbMNe4ciWC6xsLxM}})

The dashboard uses a sidebar for navigation and a top bar for search
and creating new projects.  The main area displays project cards with
placeholders for an image and the project name.  A distinct card
invites users to create a new project.

## Shots & Planner

![Shots & Planner wireframe]({{file:file-TgTTDxQrByda9rnof6CVWV}})

This page consolidates shot management and planning.  A sidebar
filters shots (all, by project, unassigned).  A toolbar allows
filtering by project/date and adding new shots.  The list view shows
columns for shot name, date, project and status.  Later iterations may
add gallery or Kanban views.

## Products

![Products wireframe]({{file:file-2ViUR3uqUJBahidnA77FNL}})

The products page displays product families as cards with an image
placeholder and product name.  Controls include a search bar, view
mode toggle and a button to create a new product.  Clicking a card
would reveal colour/size variants.

## Talent

![Talent wireframe]({{file:file-2GBEvzE5RBmLNotzdcUuR9}})

Talent are shown as cards with a portrait placeholder and the model’s
name.  A search bar and a new‑talent button allow quick actions.
Filters across the bottom can narrow results by gender, agency or
custom tags.

## Pulls

![Pulls wireframe]({{file:file-GSe4Pc81nCHE5RJJRtrpwA}})

Pulls list SKUs, quantities, sizes and fulfilment status.  A toolbar
lets users select a project/date and create a new pull.  A flagged
section shows items that appear in shots but are missing from the pull,
so producers can quickly add them.

## Admin Panel

![Admin wireframe]({{file:file-2PXt7v2d9PupXpDmaiWMU1}})

The admin panel provides a table of users with their email, role and
status.  Actions allow editing or deleting users.  An invitation
button lets admins send an invite to new users.  Roles should map to
Firebase custom claims and project memberships.

These wireframes should be refined through user feedback and visual
design.  They serve as a starting point for implementing the UI in
React/Tailwind.
