# Shot Editor V3 — Information Architecture (IA)
Version: v0.1
Status: Authoritative (Design Contract)

---

## Core Premise

Shot Editor V3 is a **page-level creative workspace**.

It is NOT:
- a modal
- a form
- a dashboard
- a sidebar-driven editor

Editing happens in ONE place.
Context lives AROUND the work.
Only ONE primary mental task is supported at a time.

---

## Global Layout Model



SHOT EDITOR V3 — INFORMATION ARCHITECTURE (IA)

┌───────────────────────────────────────────────────────────────────────────┐
│ HEADER BAND — IDENTITY & DERIVED TRUTH                                     │
│                                                                           │
│ Shot Name (inline)     Status Badge     Shot # / ID     Derived Chips     │
│ (human-first)                           (secondary)     (hero, colorway) │
│                                                                           │
│ Global actions: Duplicate · More actions                                  │
└───────────────────────────────────────────────────────────────────────────┘


┌───────────────────────┬───────────────────────────────────────────────────┐
│ CONTEXT DOCK (LEFT)   │ PRIMARY CANVAS                                     │
│ READ-ONLY SUMMARY     │ CREATIVE / DECISION SURFACE                         │
│                       │                                                     │
│ What is TRUE now?     │ Where WORK happens                                  │
│                       │                                                     │
│ ─ Status              │ 1. SHOT NOTES (Primary Thinking Surface)            │
│   • Complete          │    - Rich text                                      │
│                       │    - Formatting toolbar                              │
│ ─ Products            │    - Inviting, framed surface                        │
│   • 2 assigned        │                                                     │
│   • Hero: Hoodie      │ 2. LOOKS (Creative Spine)                            │
│                       │                                                     │
│ ─ Talent              │    LOOK TABS / SEGMENTS                              │
│   • 1 assigned        │    [ Primary ] [ Alt A ] [ Alt B ] [ + ]             │
│                       │                                                     │
│ ─ Location             │    ACTIVE LOOK CANVAS                               │
│   • Studio A           │    - Hero product                                   │
│                       │    - Supporting products                             │
│ ─ Tags                 │    - Persistent context (gender, colorway)         │
│   • Men                │                                                     │
│                       │ 3. SUPPORTING SECTIONS (Collapsed by default)        │
│ ─ Activity             │    - Logistics                                      │
│   • Read-only          │    - Talent                                         │
│                       │    - (Planned / future)                              │
│                       │                                                     │
│ Interaction rules:     │ Only ONE section should feel "active" at a time    │
│ - No editing           │                                                     │
│ - No pickers           │                                                     │
│ - Click = focus        │                                                     │
└───────────────────────┴───────────────────────────────────────────────────┘
