<!--- Shot Builder Guardrails

This document enumerates the guardrails and constraints that should be
respected throughout the development of the Shot Builder app.  These
rules are intended to prevent security breaches, data loss and
misalignment with business requirements.  The GPT‑5 Codex agent should
consult this list whenever making design or implementation decisions.  -->

# 🛡️ Guardrails & Considerations

## 🔐 Security & Privacy

1. **Secrets management** – never commit Firebase or third‑party
   credentials to version control.  Use environment variables (`.env`)
   and GitHub Action secrets.  The starter kit includes an `.env.example` and
   expects secrets to be injected during build【448511707175924†L70-L92】.
2. **Role enforcement** – implement role‑based access control with
   Firestore rules.  Always check both the user’s global role and
   their membership/role within a project before allowing reads or
   writes【209387305302324†L1422-L1436】.  Default deny; only grant
   privileges when conditions are explicitly met.
3. **Data partitioning** – isolate project data under `/projects/{id}`
   and enforce that users cannot access documents from other projects.
   Avoid using top‑level collections for project‑specific data.
4. **Input validation** – validate all user input on both client and
   server.  Ensure that text fields are sanitized to prevent script
   injection; limit image uploads to expected formats and sizes.
5. **Sensitive information** – minimise the amount of personal data
   stored for talent and users.  Collect only what is necessary (e.g.
   name, sizes, agency contact) and provide a privacy policy and
   consent mechanism.  Do not store credit card or payment data.
6. **Audit logs** – maintain a history of critical changes (e.g.
   product edits, deletions, role changes).  Use timestamps and user
   identifiers to enable traceability.  Provide soft delete options
   instead of hard deletions where possible.

## 📈 Performance & Data Modeling

1. **Read/write patterns** – model Firestore collections to match the
   queries you need.  For example, store shot documents under
   `/projects/{id}/shots` so you can query all shots for a project
   without scanning the entire database.  Avoid deeply nested
   subcollections unless necessary.
2. **Index management** – create composite indexes for queries that
   filter and sort on multiple fields.  Monitor the automatic index
   creation in the Firebase console and commit index definitions to
   source control.
3. **Pagination & limits** – implement pagination (using cursors) for
   lists of shots, products and talent.  Never load unbounded
   collections in one go.
4. **File storage** – store images and other large assets in Firebase
   Storage.  Save only the storage paths in Firestore documents.  Use
   Cloud Functions to delete orphaned files when entities are removed.
5. **Cloud Functions** – delegate heavy operations (CSV import,
   PDF export, nightly snapshots) to Cloud Functions to keep the UI
   responsive【261360160490396†L23-L24】.  Enforce proper IAM roles on
   functions and ensure they validate user identity.

## 🎨 UI & UX Guidelines

1. **Consistency** – reuse UI components (buttons, forms, tables,
   cards) to provide a consistent look and feel.  Follow the design
   language of Unbound Merino where possible.
2. **Accessibility** – include ARIA labels, keyboard navigability and
   colour contrast checks.  Avoid relying solely on colour to convey
   status.  Provide alt text for images.
3. **Responsive design** – ensure the layout works on laptops,
   tablets and phones.  Use flexible grids and media queries.
4. **Progressive enhancement** – implement simple list views first;
   add advanced features (drag‑and‑drop, Kanban) later.  Avoid
   blocking core workflows behind feature flags until they are stable.
5. **Error handling** – display clear error messages when network
   requests fail or inputs are invalid.  Log errors to Crashlytics
   or a similar service for monitoring.

## 👥 Collaboration & Code Quality

1. **Branching strategy** – create feature branches (`feature/...`) and
   keep each PR focused on a single concern.  Do not mix unrelated
   changes.
2. **Testing** – write unit tests with Vitest and integration tests
   using the Firebase emulator.  Aim for coverage of auth flows,
   Firestore rules and component behaviour.
3. **Documentation** – update the `AGENT_GUIDE.md` whenever you add
   significant features or change patterns【18543939969052†L56-L60】.
   Include acceptance checklists in PR bodies as described in the
   guide【18543939969052†L62-L69】.
4. **Assumption challenge** – as the user requested, the agent must
   analyse assumptions, provide counterpoints and test reasoning.  If
   a requirement conflicts with security, performance or testability,
   call it out and propose alternatives【18543939969052†L56-L60】.

By adhering to these guardrails, the project will maintain a high
standard of security, performance, user experience and code quality
while iterating quickly.
