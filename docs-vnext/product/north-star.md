# North Star — Shot Builder vNext

> Draft v1 — 2026-01-30

## Target Users & Jobs-to-Be-Done

### Primary Personas

| Persona | Role | Primary Job |
|---------|------|-------------|
| **Producer** | admin / producer | Move projects from brief to shoot-ready as fast as possible |
| **Wardrobe Stylist** | producer / wardrobe | Assemble, track, and fulfill product pulls for each shoot |
| **Crew Member** | crew | Know what's needed, where, and when — and flag issues |
| **Warehouse Operator** | warehouse | Pick, pack, and confirm pull sheet items accurately |
| **Viewer / Client** | viewer | Review shot plans and progress without editing |

### Core Jobs-to-Be-Done

1. **Plan shots quickly** — Go from a brief or idea to a structured shot list with assigned products, talent, and locations.
2. **Track readiness** — See at a glance what's done, what's missing, and what's blocking a project from being shoot-ready.
3. **Generate pull sheets** — Translate shot plans into warehouse-actionable pull sheets with the right SKUs, sizes, and quantities.
4. **Fulfill and confirm** — Pick items in the warehouse, confirm fulfillment status, and flag issues back to production.
5. **Operate on set** — Check shot details, update statuses, add notes, and flag problems from a phone.

## North Star Statement

> **Materially reduce the time and friction it takes to move from a brief to a fully shoot-ready state.**

Mobile support and team coordination are enablers of this outcome, not goals in themselves.

## Success Metrics

| Metric | Measurement | Target |
|--------|-------------|--------|
| **Brief → Shoot-Ready Time** | Calendar days from project creation to all shots marked "ready" | Measurably faster than current app for same-complexity projects |
| **Pull Sheet Accuracy** | % of pull items correctly fulfilled without change orders | > 95% |
| **Mobile Task Completion** | % of operational tasks (status, confirm, flag) completable on mobile | 100% of designated mobile actions |
| **Error Rate** | Unhandled errors per session (Sentry) | < 0.5% of sessions |
| **Time to First Meaningful Paint** | Mobile LCP on 4G | < 2.5s |

## Non-Goals / Anti-Goals

These are explicitly out of scope for vNext:

- **Cross-industry abstraction** — vNext is opinionated for production workflows, not a generic project management tool.
- **Maximum flexibility** — Fewer knobs, fewer modes. Opinionated defaults over configuration.
- **Feature parity with current app on day 1** — vNext ships vertical slices, not a monolith port.
- **Advanced theming / palette management** — Cut or defer. Design tokens are fixed, not user-customizable.
- **Deep versioning / audit trails** — Defer version history UI. Activity feed is sufficient for accountability.
- **Secondary analytics / insights** — Defer dashboards beyond the readiness summary.
- **Rarely used export formats** — Support CSV and a single PDF template. Cut advanced export customization.
- **Offline write capability** — Read-only offline caching only. No offline mutation queue in v1.

## Guiding Principles

1. **Design-first** — Consistent component reuse, calm hierarchy, no one-off primitives. Every surface uses the same building blocks.
2. **Reuse-first** — Reuse existing Firestore collections, document shapes, auth infrastructure, and security rules. No data migration unless overwhelmingly justified.
3. **Mobile-first** — Every layout starts from the smallest viewport. Desktop adds density, not different workflows.
4. **Fewer surfaces** — Each new page/modal must justify its existence. Prefer inline actions and progressive disclosure over new routes.
5. **Readiness as the organizing principle** — The UI should always answer: "What's left before this project is shoot-ready?"
6. **Explicit over clever** — Deterministic UI states. Clear empty/error/loading patterns. No magic, no hidden state.
