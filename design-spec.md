# Shot Editor V3 — Design Specification
Version: v1.0 (Design-First Reset)

## Purpose

This document defines the NON-NEGOTIABLE design and interaction rules for Shot Editor V3.

This is not a feature spec.
This is a spatial, interaction, and intent contract.

If implementation conflicts with this spec, the implementation is wrong.

---

## Core Premise

Shot Editor V3 is a PAGE-LEVEL CREATIVE WORKSPACE.

It is NOT:
- A modal
- A form
- A dashboard
- A sidebar-driven editor

The editor must support ONE primary mental task at a time.

---

## Spatial Contract

The editor is composed of exactly three regions:

1. HEADER BAND
2. CONTEXT DOCK (LEFT)
3. PRIMARY CANVAS

This structure is fixed and invariant.

---

## 1. Header Band — Identity & Derived Truth

Purpose:
Anchor identity and global state.

Rules:
- Shallow height
- No scrolling responsibility
- No complex editing flows

Contains:
- Shot Name (inline editable, human-authored)
- Shot Number / ID (secondary)
- Status badge
- Derived chips (hero product, colorway)
- Global actions (duplicate, more)

Explicitly forbidden:
- Product selection
- Notes
- Looks
- Talent
- Location

---

## 2. Context Dock — Read-Only Truth Panel

Purpose:
Answer: "What is true about this shot right now?"

Rules:
- READ-ONLY
- No dropdowns
- No pickers
- No inline editing

Allowed rows:
- Status
- Products summary
- Talent summary
- Location summary
- Tags summary
- Activity (read-only)

Interaction rule:
- Clicking a row scrolls/focuses the corresponding section in the Primary Canvas.

If a row needs editing → it does NOT belong in the Context Dock.

---

## 3. Primary Canvas — Where Work Happens

Purpose:
All creative and decision-making activity.

Narrative order:
1. Shot Notes
2. Looks
3. Supporting Sections (collapsed by default)

Only ONE section should feel active at a time.

---

## Shot Notes

Shot Notes are the PRIMARY thinking surface.

Rules:
- Always visible
- Always editable (unless readonly)
- Must include a visible formatting toolbar
- Must feel inviting, not like a textarea

If users do not instinctively start typing here, the design has failed.

---

## Looks — Creative Spine

Mental model:
A shot has ONE primary Look and zero or more alternates.

Rules:
- One Look is always active
- Only the active Look is editable
- Non-active Looks are scannable but inert

Structure:
- Look tabs or segmented control
- Active Look Canvas with:
  - Hero product
  - Supporting products
  - Persistent context (gender, colorway)

Looks are arguments, not configuration checklists.

---

## Product Selection Rules

- Product selection is ALWAYS scoped to the active Look.
- Context (gender, category, colorway) must be visible BEFORE confirmation.
- Blind "add to cart" behavior is forbidden.

---

## Supporting Sections (Logistics, Talent, etc.)

Rules:
- Collapsed by default
- Clearly marked as secondary
- No "coming soon" embarrassment

If not ready, hide or label as "Planned".

---

## Shot Creation vs Editing

Creation and editing share the SAME editor.

Creation may add a lightweight guided prelude, but must drop into the same editor with pre-filled state.

No parallel editors allowed.

---

## Enforcement

Before implementing any Shot Editor V3 change:
- Verify alignment with this spec
- If unclear, STOP and ask

This spec overrides convenience, legacy patterns, and partial parity.
