---
name: Sprint S12 Feature Decisions
description: User decisions for Request Centre notifications, overhaul, and bulk product-to-shot generation (2026-03-28)
type: project
---

## Request Centre Notifications

- **Email recipients**: Submitter picks specific admin/producer(s) OR leaves unchecked → email goes to all admin+producer users
- **In-app**: Sidebar badge count + dedicated notification centre (not just badge)
- **Trigger**: On request submission, and optionally on triage (absorbed/rejected) back to submitter

**Why:** Producers currently discover new requests only by visiting /requests. Email + in-app badge ensures time-sensitive requests (especially urgent) aren't missed.

**How to apply:** Build recipient picker into SubmitShotRequestDialog, Cloud Function trigger on shotRequests onCreate, email via Resend, in-app via real-time Firestore subscription.

## Request Centre Overhaul

- User wants conversation threads on requests (not just notes field)
- Product attachment at request stage (browse/search product library)
- Reference attachments (images, URLs, richer than current URL-only strings)
- This upgrades the request from a simple form to a collaborative brief

**Why:** The current request form is too lightweight for real creative briefs. Teams need to discuss, attach products, and share references before triage.

**How to apply:** Separate slice from notifications. Add comments subcollection, product picker integration, and reference upload to request detail view.

## Bulk Product → Shot Generation

- **Granularity**: One shot per SKU (colorway), with option to start at family level (placeholder shot)
- **Entry points**: Dashboard Shoot Readiness tab AND Products library page
- **Flow**: Multi-select products → pick target project → bulk create shots via writeBatch
- **Product linking**: Each generated shot auto-populated with the ProductAssignment for that SKU/family

**Why:** Currently adding products to a project requires creating shots one-by-one then assigning products individually. For high-volume e-commerce shoots with 50+ SKUs, this is prohibitively slow.

**How to apply:** Add checkbox selection to ShootReadinessWidget cards and ProductListPage, shared "Add to Project" action bar, writeBatch for atomic multi-shot creation.
