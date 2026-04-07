# CHECKPOINT — Sprint S23: Production Workflow Precision (2026-04-07)

## Build clean. Lint zero. 158 test files / 1782 tests pass. Production build succeeds.

## Completed
- [x] Phase 1A: Ghost shot fix (backfill + idempotency + client defense)
- [x] Phase 1B: Launch date sort fix (SKU data in comparator, no family fallback)
- [x] Phase 1C: Filter typography (Title Case labels)
- [x] Phase 1D: Code review + fixes (3 HIGH resolved: SKU threading in drag/grouped views)
- [x] Phase 2A: Shot number column (pinned, #, tabular-nums)
- [x] Phase 2B: Reqs column shows specific types (On-fig e-comm, Lifestyle, etc.)
- [x] Phase 2C: Style number in product column (text-2xs subtle below name)
- [x] Phase 2D: Code review + fixes (sort cache optimization, redundant dep removed)
- [x] Phase 3: Advanced filtering system (9 fields, 7 operators, URL serialization, 98 tests)
- [x] Phase 3 code review: 3 HIGH fixed (crypto.randomUUID, ref guard, readiness cache)
- [x] Phase 4B: Carrier tracking links (auto-detect, deep links, edit hint, 32 tests)
- [x] Visual verification: ALL PASS
- [x] Merge wizard mockup created

## Pending
- [ ] User mockup review for Phase 4A
- [ ] Phase 4A: Product deduplication implementation
- [ ] Git commit + PR
- [ ] CLAUDE.md + Plan.md updates

## Test Coverage Delta
| Phase | New Tests |
|-------|-----------|
| Phase 1 | 6 (shotProductReadiness) + 1 (backfill) |
| Phase 2 | 11 (columns + reqs + asset types) |
| Phase 3 | 98 (conditions + serializer + engine) |
| Phase 4B | 32 (carrier detection) |
| **Total** | **+148 new tests** |
