# Continuation Prompt for Next Claude Code Session

Copy and paste the text below into a new Claude Code session to continue the improvement work:

---

## PROMPT START

I'm continuing improvements to my Shot Builder Firebase application. This is a production application for managing wardrobe/styling photo shoots with clients, projects, shots, products, and pulls.

### Current Status

**Completed:** Phase 1 security improvements (10/25 total improvements)
- ✅ Firestore backups, security headers, storage validation
- ✅ Dynamic system admin management
- ✅ Code splitting implemented
- ✅ Firestore hook optimizations

**Recent Work (Oct 6, 2025):**
- Attempted to fix pull sharing feature (resolvePullShareToken Cloud Function)
- Discovered GCP organization policy blocks ALL public Cloud Function access (v1 and v2)
- Documented Firestore Security Rules workaround solution

**Critical Issue:**
The pull sharing feature (public links to shared pulls) is currently non-functional due to organization policy `iam.allowedPolicyMemberDomains` blocking public access to Cloud Functions.

### Project Context

**Tech Stack:**
- Frontend: React + Vite + TailwindCSS
- Backend: Firebase (Firestore, Auth, Storage, Cloud Functions, Hosting)
- Functions: Now using firebase-functions v4 (v1 API), Node 20
- Region: northamerica-northeast1

**Current Branch:** `fix/storage-bucket-cors`

**Documentation Available:**
- `/docs/IMPROVEMENTS_COMPLETE_SUMMARY.md` - Full roadmap (25 improvements)
- `/docs/IMPROVEMENTS_PHASE1_SUMMARY.md` - Phase 1 completed work
- `/docs/SESSION_2025-10-06_SUMMARY.md` - Latest session summary
- `/docs/PULLSHARE_FIRESTORE_SOLUTION.md` - Recommended fix for pull sharing
- `/docs/TROUBLESHOOTING_PULLSHARE_IAM.md` - Organization policy investigation
- `/docs/SYSTEM_ADMIN_MANAGEMENT.md` - Admin system documentation
- `/docs/BACKUP_SETUP.md` - Backup configuration guide

### Immediate Priorities

**Option A: Fix Pull Sharing (Recommended)**
Implement the Firestore Security Rules solution documented in `/docs/PULLSHARE_FIRESTORE_SOLUTION.md`:
1. Update `firestore.rules` to allow public reads with shareToken validation
2. Update `src/pages/PullPublicViewPage.jsx` to query Firestore directly
3. Test with actual share links
4. Deploy and verify functionality

**Option B: Continue Phase 2 Improvements**
Move forward with high-priority items:
1. Replace all `alert()` calls with toast notifications (3 hours)
2. Debounce search inputs in ProductsPage and ShotsPage (1 hour)
3. Upgrade Vite v4 → v5 (2-4 hours, has security vulnerabilities)
4. Implement soft deletes for Products and Shots (4 hours)

### What I Need Help With

Please review the documentation (especially `/docs/IMPROVEMENTS_COMPLETE_SUMMARY.md` and `/docs/SESSION_2025-10-06_SUMMARY.md`) and help me with:

1. **[Choose one]** Implement the Firestore Security Rules solution for pull sharing OR continue with Phase 2 improvements
2. Track progress with TodoWrite tool as we work
3. Update the roadmap document when completing items
4. Deploy changes and verify functionality

### Important Notes

- The app is in production use - test thoroughly before deploying
- Always read files before editing them
- Use the existing composite index for pull queries (already deployed)
- The pull sharing feature requires collection group queries to work across all clients/projects
- Cloud Functions v1 are deployed but cannot be made publicly accessible due to org policy

### Commands You'll Likely Need

```bash
# Build and deploy
npm run build
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only functions

# Test
npm run dev  # Local development server
```

### Project Structure

```
/src
  /components - UI components
  /pages - Page components
  /lib - Firebase config, utilities
  /hooks - Custom React hooks
/functions
  index.js - Cloud Functions (v1 API, firebase-functions v4)
firestore.rules - Security rules
firebase.json - Firebase configuration
```

Please start by reading `/docs/IMPROVEMENTS_COMPLETE_SUMMARY.md` and `/docs/SESSION_2025-10-06_SUMMARY.md`, then let me know your recommendation for how to proceed.

## PROMPT END

---

## Usage Instructions

1. Copy everything between "PROMPT START" and "PROMPT END"
2. Start a new Claude Code session
3. Paste the prompt
4. Claude will read the documentation and help you continue the work

## Additional Context

If Claude needs more specific information:

- For pull sharing implementation: refer to `/docs/PULLSHARE_FIRESTORE_SOLUTION.md`
- For Phase 2 priorities: refer to `/docs/IMPROVEMENTS_COMPLETE_SUMMARY.md` lines 114-240
- For recent changes: refer to `/docs/SESSION_2025-10-06_SUMMARY.md`
- For security context: refer to `/docs/IMPROVEMENTS_PHASE1_SUMMARY.md`

---

**Created:** 2025-10-06
**Last Session:** Pull sharing Cloud Functions investigation (organization policy blocker)
**Next Action:** Choose between fixing pull sharing (Option A) or continuing Phase 2 improvements (Option B)
