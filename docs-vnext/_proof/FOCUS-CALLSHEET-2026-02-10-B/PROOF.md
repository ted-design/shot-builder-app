# PROOF — Focus Callsheet Trust Core B

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added shared time classifier for callsheet people fields:
  - `src/lib/time/callsheetTimeEntry.js`
  - Classifies input as `time` / `text` / `empty` / `invalid-time`.
  - Normalizes accepted times to canonical `HH:MM`.
- Wired talent calls to shared classifier:
  - `src/components/callsheet/TalentCallsCard.jsx`
  - `call`, `set`, and `wrap` now use canonical parsing.
  - Invalid time-like entries revert the edited draft field and show explicit toast feedback.
  - `set` input no longer relies on browser `type="time"`; it uses the same text + parser path.
- Wired client calls to shared classifier:
  - `src/components/callsheet/ClientsCallsCard.jsx`
  - `call` and `set` now use canonical parsing and the same invalid-entry behavior.
  - `set` input no longer relies on browser `type="time"`; it uses the same text + parser path.
- Wired crew calls to shared classifier:
  - `src/components/callsheet/CrewCallsCard.jsx`
  - Per-row crew call override now uses canonical classifier logic.
  - Department bulk precall modal now follows the same parsing semantics as per-row crew calls.
- Added hook-level guardrails so malformed times cannot persist via alternate write paths:
  - `src/hooks/useTalentCalls.ts`
  - `src/hooks/useClientCalls.ts`
  - `src/hooks/useCrewCalls.ts`
  - All three now normalize read values and sanitize write updates for `callTime/callText` (and time-only fields) through the same classifier.
- Tightened time validity in shared crew helpers:
  - `src/lib/time/crewCallEffective.js`
  - `isTimeString` now validates numeric hour/minute ranges (prevents invalid values like `24:00` / `12:60` from being considered time strings).
- Added/updated tests:
  - `src/lib/time/__tests__/callsheetTimeEntry.test.js`
  - `src/lib/time/__tests__/crewCallEffective.test.js`

## Validation Log
1. Targeted time + schedule trust tests:
   - Command:
     - `npm run test -- src/lib/time/__tests__/callsheetTimeEntry.test.js src/lib/time/__tests__/crewCallEffective.test.js src/lib/__tests__/buildEntryTimeCascadePlan.test.js src/lib/__tests__/getApplicableTrackIds.test.js src/lib/__tests__/gaplessSchedule.test.js src/lib/__tests__/cascadeEngine.test.js`
   - Result:
     - 6 files passed, 61 tests passed.

2. Lint gate:
   - Command:
     - `npm run lint`
   - Result:
     - Pass (0 warnings).

3. Build gate:
   - Command:
     - `npm run build`
   - Result:
     - Pass (production build completed successfully).

## Manual QA Required

⚠️ P.3.2 Note: Chrome extension unavailable for visual verification in this execution context.

| Scenario | Steps | Expected |
|----------|-------|----------|
| Talent call accepts AM/PM and canonicalizes | In Talent section, enter `6:17 AM` in `Call`, blur field | Row persists; stored/rendered value resolves as time (not text), no error toast |
| Talent/client set rejects invalid time | Enter `24:00` in `Set`, blur field | Error toast shown; field reverts to previous persisted value |
| Crew call text override preserved | In Crew section, enter `OFF` in override field, blur | `callText` path persists; effective display shows text override |
| Crew department precall consistent parsing | Open `Set department precall`, enter `14:30`, apply | All rows in department get canonical `callTime` and no text override |

User action: run `npm run dev` and verify scenarios above manually.
