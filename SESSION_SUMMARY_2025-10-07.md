# Session Summary - October 7, 2025
## Firebase App Check Environment Detection Fix

### Problem
The application was experiencing persistent Firestore and Storage permission errors during local development, despite having:
- Correct Firebase authentication with valid custom claims (role: admin, clientId: unbound-merino)
- Properly configured Firestore security rules
- Valid user credentials

The errors manifested as:
- `FirebaseError: Missing or insufficient permissions` on all Firestore queries
- `Failed to load resource: 401` errors for Firebase Storage image requests
- Complete inability to load user data, projects, or images in local development

### Root Cause
**Firebase App Check enforcement** was enabled on both Firestore and Storage backend services, blocking all requests that didn't include valid App Check tokens.

The local development environment wasn't sending App Check tokens because:
1. Environment detection in `firebase.ts` was failing - `import.meta.env.DEV` and `import.meta.env.PROD` evaluated as `undefined`
2. With faulty environment detection, the code couldn't reliably determine dev vs prod mode
3. App Check wasn't being properly disabled for local development

Even with ultra-permissive Firestore rules (`allow read, write: if true`), App Check blocks requests at the service level **before** they reach security rules.

### Solution
Three-part fix:

#### 1. Fixed Environment Detection (Code Change)
**File:** `src/lib/firebase.ts`

Changed from unreliable `DEV`/`PROD` flags:
```javascript
const isProd = Boolean(viteEnv.PROD);
const isDev = Boolean(viteEnv.DEV);
```

To reliable `MODE` detection:
```javascript
const mode = import.meta.env.MODE || 'development';
const isProd = mode === 'production';
const isDev = !isProd;
```

Also added auth token refresh on auth state changes to ensure Firestore gets latest custom claims.

#### 2. Disabled App Check Enforcement (Firebase Console Config)
Changed App Check settings for both:
- **Cloud Firestore:** Enforced → Monitoring
- **Storage:** Enforced → Monitoring

This allows requests without App Check tokens (from local dev) while still tracking metrics.

#### 3. Updated Documentation
- Added troubleshooting section to `AGENT_GUIDE.md` documenting symptoms, root cause, solution, and prevention
- Updated `CHANGELOG.md` with fix entry

### Files Changed
- `src/lib/firebase.ts` - Environment detection fix + auth token refresh
- `AGENT_GUIDE.md` - Added troubleshooting section
- `CHANGELOG.md` - Documented fix

### Verification
After implementing the fix:
- ✅ App Check correctly disabled in development mode
- ✅ Firestore queries work correctly (user profiles, projects, collections load)
- ✅ Storage images load properly
- ✅ No permission errors in console
- ✅ All app functionality restored

### PR
**PR #157:** https://github.com/ted-design/shot-builder-app/pull/157
- Branch: `fix/app-check-environment-detection`
- Status: Open, ready for review

### Key Learnings
1. **App Check enforcement supersedes security rules** - Even with permissive Firestore rules, App Check blocks at the service level
2. **Environment detection reliability matters** - `import.meta.env.MODE` is more reliable than `DEV`/`PROD` flags in Vite
3. **Multi-service enforcement** - App Check can be enforced independently on different Firebase services (Firestore, Storage, etc.)
4. **Propagation delay** - App Check enforcement changes take 30-60 seconds to propagate globally
5. **Development workflow** - For local dev, use "Monitoring" mode; re-enable "Enforced" for production

### Future Considerations
- Monitor App Check metrics in Firebase Console to ensure legitimate traffic
- Consider automating App Check mode switching via Terraform/Firebase CLI for different environments
- Document App Check setup in onboarding docs for new developers
- Consider adding development-specific App Check debug tokens for more realistic testing

---

*Generated with [Claude Code](https://claude.com/claude-code)*
