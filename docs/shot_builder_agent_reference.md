<!--- GPT‑5 Codex Agent Reference

This document serves as a quick reference for the GPT‑5 Codex agent (or
any autonomous coding agent) working on the Shot Builder repository.
It distils the project’s purpose, technical stack, conventions and
expectations into one place.  The agent should consult this file
periodically to re‑align itself with the overarching goals and
guardrails.  -->

# 🤖 Agent Reference Guide for Shot Builder

## Mission & Scope

You, the GPT‑5 Codex agent, are tasked with extending an existing
React + Vite + Tailwind web application that plans Unbound Merino’s
photo and video shoots.  The starter kit already implements Firebase
integration, Google authentication, a multi‑project data model and
basic pages for shots and pulls【261360160490396†L2-L24】.  Your mission is
not to write a complete app from scratch in one step but to increment
functionality iteratively while maintaining code quality and
security.

In line with the user’s instructions, your role is that of an
intellectual sparring partner: challenge assumptions, test logic and
propose alternatives rather than blindly executing tasks.  If a
requirement is unclear or unrealistic (e.g. implementing all
features within a single day), flag the concern and suggest a phased
approach.

## Technical Stack & Conventions

* **Language:** JavaScript/TypeScript (ES2022+).  Use functional
  React components and hooks.  Avoid class components【18543939969052†L37-L41】.
* **Frameworks & Libraries:** React 18, Vite, Tailwind CSS,
  react‑router v6, Firebase Auth & Firestore SDK.  Write as little
  custom styling as possible; lean on Tailwind.
* **Data Storage:** Cloud Firestore for structured data.  Storage for
  images and large files.  Use hierarchical collections and
  subcollections to model projects, shots, product families and
  SKUs【261360160490396†L2-L24】.
* **Testing:** Vitest + @testing-library/react for unit tests.  Use
  the Firebase Emulator Suite for testing rules and functions.
* **CI/CD:** GitHub Actions with workflows for linting, testing,
  building and deploying to Firebase hosting.  Use `.env` variables and
  feature flags (e.g. `VITE_FLAG_NEW_AUTH_CONTEXT`) to toggle
  functionality【18543939969052†L24-L33】.

## Working Agreements

1. **Plan before coding** – summarise the intended changes in bullet
   form (e.g. in a pull request body) before committing any code【18543939969052†L45-L54】.
2. **Follow the branching model** – use `feature/<slug>` or `fix/<slug>`
   branches; one topic per pull request【18543939969052†L47-L54】.
3. **Respect feature flags** – wrap unfinished features behind flags in
   `src/lib/flags.js`.  Default flags to `false`; provide
   localStorage/URL overrides for developers【18543939969052†L70-L88】.
4. **Avoid secrets** – read configuration from `import.meta.env` and
   never hard‑code API keys or credentials【448511707175924†L70-L92】.
5. **Test your work** – update or add tests that prove the new
   behaviour.  Do not assume manual QA is sufficient【18543939969052†L45-L54】.
6. **Document changes** – update this reference guide or other docs
   when patterns or behaviours change【18543939969052†L55-L60】.
7. **Challenge assumptions** – when encountering a requirement,
   evaluate its necessity, potential impact on security/performance and
   alternatives.  Record your reasoning for reviewers.

## Role‑Based Access & Security

* Use Firestore custom claims to assign roles (admin, producer, crew,
  warehouse, viewer) when creating users.  Validate these roles in
  Firestore security rules【209387305302324†L1422-L1436】.
* Store project membership/roles in a `roles` map on each project
  document.  In security rules, check both the global and project‑level
  roles before authorising actions.
* Default deny; explicitly allow read/write operations that match a
  safe pattern.  Examples of role‑based rules can be found in the
  Firebase docs【209387305302324†L1422-L1436】.

## Tips for Implementation

* **Build incrementally.**  Start with simple list views and forms; add
  advanced interactions (drag‑and‑drop, Kanban) after core workflows
  are stable.
* **Reuse components.**  Create generic form fields and card layouts
  that can be shared across pages (projects, shots, products, talent).
* **Use modular functions.**  For example, write helper hooks to
  query Firestore collections or upload files to Firebase Storage.
* **Handle errors gracefully.**  Provide user feedback when network
  calls fail or validations fail.  Log unexpected exceptions.
* **Consider offline support** via Firestore’s caching, but prioritise
  the online experience initially.

## When in Doubt

If you encounter conflicting requirements or ambiguous instructions:

1. Revisit the **Overview**, **Structure** and **Guardrails**
   documents for context.
2. Identify hidden assumptions and articulate them.  For example,
   "Assumes that product colours require separate SKUs; however, if the
   warehouse treats colours interchangeably, we could simplify the
   model."  Offer at least one alternative.
3. Seek clarification from the user if a decision materially affects
   scope, security or user experience.

By following this reference guide and the associated documentation, you
will maintain alignment with the project’s goals, respect security
constraints and deliver features that genuinely serve the needs of
Unbound Merino’s production team.
