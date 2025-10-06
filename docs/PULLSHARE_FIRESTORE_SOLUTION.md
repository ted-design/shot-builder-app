# Pull Share - Firestore Security Rules Solution

## Background

The original solution used a Cloud Function to resolve share tokens server-side. However, the GCP organization policy `iam.allowedPolicyMemberDomains` prevents granting public access to Cloud Functions (both v1 and v2), making server-side resolution impossible.

**Attempted Solutions:**
- ✅ Cloud Functions v2 with onRequest - Blocked by org policy
- ✅ Cloud Functions v1 with https.onRequest - Blocked by org policy
- ✅ Service account permissions - Blocked by org policy
- ❌ **All Cloud Functions approaches blocked**

---

## Solution: Firestore Security Rules

Since we cannot use Cloud Functions for public access, we'll use Firestore Security Rules to allow unauthenticated reads of pulls when a valid shareToken is provided.

### Security Considerations

**Trade-offs:**
- ✅ Works within organization policy constraints
- ✅ No server infrastructure needed
- ✅ Still validates shareToken and shareEnabled
- ⚠️ Exposes Firestore structure to unauthenticated users
- ⚠️ No server-side rate limiting (relies on Firebase App Check)
- ⚠️ Requires client to know clientId and projectId (can be derived from URL structure)

**Mitigation:**
- Keep shareToken long and cryptographically random (32+ characters)
- Use Firebase App Check to prevent abuse
- Monitor Firestore usage for anomalies
- Consider implementing token expiration in the client

---

## Implementation

### 1. Update Firestore Security Rules

Add a rule to allow reading pulls with valid shareTokens:

```javascript
// In firestore.rules

match /clients/{clientId}/projects/{projectId}/pulls/{pullId} {
  // Allow authenticated users with proper role to read/write
  allow read, write: if hasRole(clientId, ['admin', 'editor', 'producer', 'warehouse']);

  // Allow unauthenticated users to read if share is enabled and token matches
  allow get: if resource.data.shareEnabled == true
             && request.query.shareToken == resource.data.shareToken;
}
```

**Note:** This requires passing the shareToken as a query parameter or in the get() request context.

### 2. Update Frontend (PullPublicViewPage.jsx)

Instead of calling a Cloud Function, query Firestore directly:

```javascript
// src/pages/PullPublicViewPage.jsx

import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';

const loadPull = async () => {
  setLoading(true);
  setError(null);

  try {
    // Use collection group query to find pull across all clients/projects
    const pullsRef = collectionGroup(db, 'pulls');
    const q = query(
      pullsRef,
      where('shareToken', '==', shareToken),
      where('shareEnabled', '==', true)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      setError('Pull not found or sharing is disabled');
      setLoading(false);
      return;
    }

    const pullDoc = snapshot.docs[0];
    const pullData = pullDoc.data();

    // Check expiration client-side
    if (pullData.shareExpireAt) {
      const expireDate = pullData.shareExpireAt.toDate();
      if (expireDate < new Date()) {
        setError('Share link has expired');
        setLoading(false);
        return;
      }
    }

    setPull({
      id: pullDoc.id,
      ...pullData
    });
  } catch (err) {
    console.error('[PullPublicViewPage] Failed to load pull', err);
    setError('Failed to load pull. Please check the link and try again.');
  } finally {
    setLoading(false);
  }
};
```

### 3. Update Firestore Indexes

The composite index already exists from the previous solution:

```json
// firestore.indexes.json
{
  "indexes": [
    {
      "collectionGroup": "pulls",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "shareToken", "order": "ASCENDING" },
        { "fieldPath": "shareEnabled", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 4. Remove Firebase Hosting Rewrite

Update `firebase.json` to remove the function rewrite:

```json
// firebase.json - Remove this block:
{
  "source": "/api/resolvePullShareToken",
  "function": {
    "functionId": "resolvePullShareToken",
    "region": "northamerica-northeast1"
  }
}
```

---

## Deployment Steps

1. **Update Firestore Security Rules:**
   ```bash
   # Update firestore.rules with the new rule
   firebase deploy --only firestore:rules
   ```

2. **Update Frontend:**
   ```bash
   # Update src/pages/PullPublicViewPage.jsx
   npm run build
   firebase deploy --only hosting
   ```

3. **Verify Composite Index:**
   ```bash
   firebase deploy --only firestore:indexes
   ```

---

## Security Best Practices

### Token Generation

Ensure share tokens are cryptographically secure:

```javascript
// When generating share tokens in the app
import { randomBytes } from 'crypto';

const generateShareToken = () => {
  return randomBytes(32).toString('base64url'); // 43 characters, URL-safe
};
```

### Enable Firebase App Check

Add App Check to prevent abuse:

```bash
# Install App Check SDK
npm install firebase-app-check

# Configure in src/lib/firebase.ts
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';

initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('your-recaptcha-site-key'),
  isTokenAutoRefreshEnabled: true
});
```

Then update Firestore rules to require App Check:

```javascript
match /clients/{clientId}/projects/{projectId}/pulls/{pullId} {
  allow get: if resource.data.shareEnabled == true
             && request.query.shareToken == resource.data.shareToken
             && request.auth.token.firebase.sign_in_provider != null; // App Check
}
```

---

## Monitoring

Monitor for abuse patterns:

1. **Firestore Usage Dashboard** - Watch for spikes in read operations
2. **Create alerts** for unusual activity
3. **Log share link access** - Add client-side analytics

---

## Reverting to Cloud Function Solution

If the organization policy changes in the future, you can revert to the Cloud Function solution:

1. Re-enable the `resolvePullShareToken` function
2. Update `PullPublicViewPage.jsx` to call the function
3. Update Firestore rules to remove public read access
4. Grant allUsers invoker permission:
   ```bash
   gcloud functions add-iam-policy-binding resolvePullShareToken \
     --region=northamerica-northeast1 \
     --member=allUsers \
     --role=roles/cloudfunctions.invoker \
     --project=um-shotbuilder
   ```

---

## Summary

This solution trades server-side validation for a client-side approach that works within your organization's security constraints. While it exposes the Firestore structure, proper token generation and Firebase App Check provide adequate security for this use case.

**Last Updated:** 2025-10-06
