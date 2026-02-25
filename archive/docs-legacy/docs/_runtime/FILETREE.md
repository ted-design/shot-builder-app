# vNext File Tree (depth 4)

Generated: 2026-02-02 — VN-SHOT-04-product-assign-save-gate

```
src-vnext/
├── app/
│   ├── App.tsx
│   ├── providers/
│   │   ├── AuthProvider.tsx
│   │   ├── ProjectScopeProvider.tsx
│   │   ├── SearchCommandProvider.tsx
│   │   └── ThemeProvider.tsx
│   └── routes/
│       ├── guards/ (RequireAuth, RequireRole)
│       └── index.tsx
├── features/
│   ├── auth/components/LoginPage.tsx
│   ├── projects/
│   │   ├── components/ (ProjectDashboard, ProjectCard, CreateProjectDialog)
│   │   └── hooks/useProjects.ts
│   ├── pulls/
│   │   ├── components/ (PullListPage, PullDetailPage, PullCard, CreatePullDialog, FulfillmentToggle)
│   │   ├── hooks/ (usePulls, usePull)
│   │   └── lib/updatePull.ts
│   ├── shots/
│   │   ├── components/ (ShotListPage, ShotDetailPage, ShotCard, CreateShotDialog, + 9 more)
│   │   │   └── ProductAssignmentPicker.test.tsx  ← NEW (VN-SHOT-04)
│   │   ├── hooks/ (useShots, useShot, usePickerData)
│   │   └── lib/ (mapShot, updateShot, reorderShots, dateOnly, dateOnly.test)
│   └── schedules/
│       ├── components/ (ScheduleListPage, CreateScheduleDialog, ScheduleCard, CallSheetBuilderPage, + 8 more)
│       ├── hooks/ (useSchedules, useSchedule, useScheduleEntries, useScheduleDayDetails, useScheduleTalentCalls, useScheduleCrewCalls, useCrew)
│       └── lib/ (mapSchedule, scheduleWrites, trustChecks)
├── shared/
│   ├── components/ (AppShell, ConfirmDialog, EmptyState, ErrorBoundary, InlineEdit, + 5 more)
│   ├── hooks/ (useFirestoreCollection, useFirestoreDoc, useMediaQuery, + 3 more)
│   ├── lib/ (firebase, paths, rbac, utils, sanitizeHtml, statusMappings, uploadImage, textPreview)
│   └── types/index.ts
├── ui/ (20 shadcn components)
├── index.css
└── main.tsx
```
