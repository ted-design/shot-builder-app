# Security Audit Report - January 11, 2025

**Project**: Shot Builder App
**Audit Date**: 2025-01-11
**Auditor**: Claude Code (AI Assistant)
**Branch**: feat/phase5-6-ui-enhancements

## Executive Summary

**Total Vulnerabilities Found**: 17
- **HIGH**: 1
- **MODERATE**: 16

**Outdated Dependencies**: 26 packages

**Critical Actions Required**: 3
**Recommended Actions**: 7

---

## 1. Critical Vulnerabilities (Immediate Action Required)

### 1.1 HIGH: xlsx Prototype Pollution & ReDoS

**Package**: `xlsx@0.18.5`
**Severity**: HIGH
**CVEs**:
- [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) - Prototype Pollution
- [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) - Regular Expression Denial of Service

**Impact**:
- Direct dependency used in `src/lib/dataExport.js`
- Provides Excel (.xlsx) export functionality
- Used by `ExportButton` component across the app

**Risk Assessment**:
- **Exploitability**: Medium (requires user to export malicious data)
- **Impact**: High (code injection, DoS possible)
- **Likelihood**: Low (internal app, controlled data)
- **Overall Risk**: MEDIUM-HIGH

**Recommendation**: **Remove Excel Export (Temporary)**
**Rationale**:
1. No fix available from xlsx maintainer
2. CSV export provides equivalent functionality
3. Can migrate to `exceljs` later if needed
4. Fastest path to zero HIGH severity vulnerabilities

**Implementation**: Remove xlsx dependency, disable Excel export UI

---

## 2. Moderate Vulnerabilities (Medium Priority)

### 2.1 undici 6.0.0 - 6.21.1 (Firebase SDK)

**Packages Affected**: All Firebase packages
**Severity**: MODERATE
**CVEs**:
- [GHSA-c76h-2ccp-4975](https://github.com/advisories/GHSA-c76h-2ccp-4975) - Insufficiently Random Values
- [GHSA-cxrh-j4jr-qwg3](https://github.com/advisories/GHSA-cxrh-j4jr-qwg3) - Denial of Service

**Impact**:
- Transitive dependency through Firebase SDK
- Affects: `@firebase/auth`, `@firebase/firestore`, `@firebase/functions`, `@firebase/storage`

**Risk Assessment**:
- **Exploitability**: Low (requires network access to Firebase)
- **Impact**: Medium (randomness issues, potential DoS)
- **Likelihood**: Very Low (Firebase SDK context)
- **Overall Risk**: LOW

**Recommendation**: **Upgrade Firebase 10.14.1 → 12.5.0**
**Note**: Major version upgrade, requires migration planning (Week 4)

**Temporary Mitigation**: Fix available via `npm audit fix`

---

### 2.2 dompurify <3.2.4 (reactjs-tiptap-editor)

**Package**: `dompurify` (transitive via reactjs-tiptap-editor)
**Severity**: MODERATE
**CVE**: [GHSA-vhxf-7vqr-mrjg](https://github.com/advisories/GHSA-vhxf-7vqr-mrjg) - XSS vulnerability

**Impact**:
- Used by rich text editor component
- Could allow XSS if malicious HTML is processed

**Risk Assessment**:
- **Exploitability**: Medium (requires malicious input to editor)
- **Impact**: High (XSS can steal sessions)
- **Likelihood**: Low (internal users, trusted content)
- **Overall Risk**: LOW-MEDIUM

**Recommendation**: **Apply npm audit fix**
**Fix Available**: Yes, via `npm audit fix`

---

### 2.3 nanoid <3.3.8 or >=4.0.0 <5.0.9 (Excalidraw)

**Package**: `nanoid` (transitive via @excalidraw/excalidraw)
**Severity**: MODERATE
**CVE**: [GHSA-mwcw-c2x4-8c55](https://github.com/advisories/GHSA-mwcw-c2x4-8c55) - Predictable results

**Impact**:
- Used by Excalidraw diagrams in rich text editor
- Could generate predictable IDs

**Risk Assessment**:
- **Exploitability**: Low (requires specific non-integer inputs)
- **Impact**: Medium (ID collision)
- **Likelihood**: Very Low (Excalidraw internal use)
- **Overall Risk**: LOW

**Recommendation**: **Apply npm audit fix --force**
**Note**: Requires breaking change in reactjs-tiptap-editor

---

## 3. Outdated Dependencies (Recommended Updates)

### 3.1 Critical Security Updates

| Package | Current | Latest | Type | Priority |
|---------|---------|--------|------|----------|
| @sentry/react | 10.17.0 | 10.25.0 | Patch | HIGH |
| firebase | 10.14.1 | 12.5.0 | Major | MEDIUM |
| firebase-admin | 12.7.0 | 13.6.0 | Major | MEDIUM |

**@sentry/react Update**:
- 8 patch versions behind
- May contain security fixes and bug fixes
- Safe to update (patch version)
- **Recommendation**: Update immediately

### 3.2 Major Version Updates (Week 4 Planning)

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| react | 18.3.1 | 19.2.0 | Yes (React 19) |
| react-dom | 18.3.1 | 19.2.0 | Yes |
| tailwindcss | 3.4.17 | 4.1.17 | Yes (v4 major rewrite) |
| react-router-dom | 6.30.1 | 7.9.5 | Yes |
| zod | 3.25.76 | 4.1.12 | Yes |
| vitest | 3.2.4 | 4.0.8 | Yes |
| @vitejs/plugin-react | 4.7.0 | 5.1.0 | Yes |

**Recommendation**: Plan separate migration for each major version (Week 4)

### 3.3 Minor/Patch Updates (Safe to Apply)

| Package | Current | Latest | Type |
|---------|---------|--------|------|
| @eslint/js | 9.35.0 | 9.39.1 | Patch |
| eslint | 9.35.0 | 9.39.1 | Patch |
| lucide-react | 0.268.0 | 0.553.0 | Minor |
| vite | 7.1.9 | 7.2.2 | Patch |
| autoprefixer | 10.4.21 | 10.4.22 | Patch |

**Recommendation**: Apply immediately

---

## 4. Code Security Review

### 4.1 Console Statements in Production Code

**Finding**: 367 console statements across 75 files

**Risk**: MEDIUM
**Impact**: Potential information leakage in production

**Files with Most Console Statements**:
1. `src/pages/ShotsPage.jsx` - 26 statements
2. `src/pages/PlannerPage.jsx` - 24 statements
3. `src/hooks/useFirestoreMutations.js` - 14 statements
4. `src/hooks/useFirestoreQuery.js` - 10 statements
5. `src/lib/firebase.ts` - 10 statements

**Recommendation**:
1. Replace with structured logging (Sentry already integrated)
2. Add ESLint rule: `no-console: "error"`
3. Keep console.error for critical errors only
4. Use Sentry for all other logging

**Plan**: Week 3 Day 4 (Console cleanup sprint)

### 4.2 Image Upload Security

**Finding**: Client-side only file validation

**Files**:
- `src/components/common/SingleImageDropzone.jsx`
- `src/lib/images.js`

**Risk**: LOW
**Current Mitigation**: File type and size checks on client

**Recommendation**: Add server-side validation in Cloud Functions (Future enhancement)

### 4.3 Pull Sheet Sharing Security

**Finding**: Public sharing uses `shareToken` (32+ char random string)

**Files**:
- `src/components/pulls/PullShareModal.jsx`
- Firebase security rules

**Risk**: LOW
**Current Mitigation**: Cryptographically secure tokens

**Recommendation**: Consider adding rate limiting to prevent token brute-force

---

## 5. Firebase Security

### 5.1 Security Rules

**Status**: ✅ GOOD

**Strengths**:
- Client scoping properly enforced (`clientMatches(clientId)`)
- Role-based access control via custom claims
- Activity feed immutability enforced
- Pull sharing validated with shareToken

**Recommendation**: No immediate changes needed

### 5.2 Custom Claims Security

**Status**: ✅ GOOD

**Strengths**:
- Claims set via Cloud Functions only
- Claims validation in Firestore rules
- UI checks permissions before rendering actions

**Recommendation**: Document claim refresh requirement in onboarding

---

## 6. Action Plan

### Immediate (Today - Week 1 Day 3)

1. ✅ **Remove xlsx dependency** (fixes HIGH vulnerability)
   - Remove Excel export from ExportButton UI
   - Remove xlsx import from dataExport.js
   - Run `npm uninstall xlsx`

2. ✅ **Update @sentry/react** (10.17.0 → 10.25.0)
   - Run `npm update @sentry/react`

3. ✅ **Apply safe npm audit fixes**
   - Run `npm audit fix`

4. ✅ **Update minor/patch dependencies**
   - eslint, vite, lucide-react, autoprefixer

### Short Term (Week 1-2)

5. **Add dependency scanning to CI**
   - Add `npm audit` to GitHub Actions workflow
   - Set vulnerability threshold (fail on HIGH/CRITICAL)

6. **Add ESLint no-console rule**
   - Configure in eslintrc
   - Allow console.error only

### Medium Term (Week 3-4)

7. **Console statement cleanup** (Week 3 Day 4)
   - Replace 367 console statements with Sentry logging
   - Add structured logging patterns

8. **Plan major dependency upgrades** (Week 4)
   - React 18 → 19
   - Firebase 10 → 12
   - Tailwind v3 → v4

### Long Term (Future)

9. **Add server-side image validation**
   - Cloud Function for file validation

10. **Add rate limiting for public shares**
    - Prevent token brute-force attacks

---

## 7. Risk Summary

| Risk Level | Count | Status |
|------------|-------|--------|
| HIGH | 1 | ⚠️ Fix Today |
| MODERATE | 16 | ⏳ Fix This Week |
| LOW | 3 | 📋 Plan for Later |

**Overall Security Posture**: GOOD with known issues being addressed

**Timeline to Zero HIGH**: Today (remove xlsx)
**Timeline to Zero MODERATE**: 1-2 weeks (Firebase upgrade, audit fixes)

---

## 8. Compliance & Best Practices

### ✅ Good Practices Found

1. Input sanitization (CSV/Excel exports)
2. Firestore security rules with client scoping
3. Role-based access control
4. Sentry error tracking integrated
5. Environment variable protection
6. HTTPS only in production (Firebase Hosting)

### ⚠️ Areas for Improvement

1. Console logging in production
2. No dependency scanning in CI (yet)
3. Major dependencies outdated
4. No automated security testing

---

## 9. Recommendations Priority Matrix

```
HIGH IMPACT, URGENT:
┌──────────────────────────────────┐
│ 1. Remove xlsx (HIGH vuln)       │
│ 2. Update @sentry/react           │
│ 3. Apply npm audit fix            │
└──────────────────────────────────┘

HIGH IMPACT, NOT URGENT:
┌──────────────────────────────────┐
│ 4. Firebase 10 → 12 upgrade      │
│ 5. Console cleanup (367 stmts)   │
└──────────────────────────────────┘

LOW IMPACT, URGENT:
┌──────────────────────────────────┐
│ 6. Minor dependency updates       │
│ 7. Add CI security scanning       │
└──────────────────────────────────┘

LOW IMPACT, NOT URGENT:
┌──────────────────────────────────┐
│ 8. Server-side file validation    │
│ 9. Rate limiting for shares       │
└──────────────────────────────────┘
```

---

**Audit Completed**: 2025-01-11
**Next Audit**: 2025-02-11 (Monthly)
**Contact**: Automated via Claude Code quality improvement initiative
