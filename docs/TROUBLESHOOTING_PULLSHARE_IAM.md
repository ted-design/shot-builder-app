# Troubleshooting: Pull Share Token IAM Permissions

**Issue:** The `resolvePullShareToken` Cloud Function cannot be made publicly accessible due to an organization policy restriction.

**Error:** `One or more users named in the policy do not belong to a permitted customer, perhaps due to an organization policy.`

---

## Root Cause

The GCP organization has a policy constraint `iam.allowedPolicyMemberDomains` that restricts which domains can be granted IAM permissions. This policy only allows `googleapis.com` domain (Google service accounts), blocking:
- `allUsers` (anonymous public access)
- `allAuthenticatedUsers` (any authenticated Google account)

---

## Current Status

✅ **Function Deployed:** `resolvePullShareToken` is deployed as an HTTP function (onRequest) at:
   `https://northamerica-northeast1-um-shotbuilder.cloudfunctions.net/resolvePullShareToken`

✅ **Service Account Access:** The App Engine default service account has invoker permissions:
   `168065141847-compute@developer.gserviceaccount.com`

✅ **Firebase Hosting Rewrite:** Configured in `firebase.json` to route `/api/resolvePullShareToken` to the function

❌ **Public Access:** Blocked by organization policy - Firebase Hosting rewrites to Cloud Functions v2 require public access

---

## Solution Options

### Option 1: Request Organization Policy Exception ⭐ **RECOMMENDED**

Work with your GCP organization administrator to add an exception for this specific Cloud Run service.

**Steps:**
1. Contact your GCP org admin
2. Request an exception to the `iam.allowedPolicyMemberDomains` policy for:
   - **Service:** `resolvepullsharetoken`
   - **Region:** `northamerica-northeast1`
   - **Project:** `um-shotbuilder`
3. Once approved, run:
   ```bash
   gcloud run services add-iam-policy-binding resolvepullsharetoken \
     --region=northamerica-northeast1 \
     --member=allUsers \
     --role=roles/run.invoker \
     --project=um-shotbuilder
   ```

**Justification for org admin:**
> This Cloud Function provides read-only access to shared pull data via secure tokens. It does not expose sensitive information and includes server-side validation, rate limiting, and expiration checks. Public access is required for unauthenticated users to view shared pulls.

---

### Option 2: Convert to Cloud Functions v1

Cloud Functions v1 integrate more seamlessly with Firebase Hosting and don't require explicit IAM permissions.

**Steps:**
1. Update `functions/index.js`:
   ```javascript
   const functions = require('firebase-functions');

   exports.resolvePullShareToken = functions.https.onRequest(async (req, res) => {
     // Same implementation as current onRequest function
     // ...
   });
   ```

2. Deploy:
   ```bash
   firebase deploy --only functions:resolvePullShareToken
   ```

**Trade-offs:**
- ✅ Works with Firebase Hosting rewrites without IAM issues
- ✅ Simpler deployment model
- ❌ Cloud Functions v1 will be deprecated eventually (but still supported until 2025+)
- ❌ Less control over CORS and HTTP responses

---

### Option 3: Use Cloud Functions Invoker Service Account

Grant access to a specific service account that your application uses.

**Not viable for this use case** because public share links need to work for unauthenticated users.

---

## Recommended Immediate Action

1. **Request org policy exception (Option 1)** - This is the cleanest solution for Cloud Functions v2
2. **While waiting for approval, document the issue** for users trying to use share links
3. **Consider Option 2 (v1 functions)** if org policy exception cannot be obtained

---

## Testing the Fix

Once public access is granted, test with:

```bash
# Test the function directly
curl -X POST https://um-shotbuilder.web.app/api/resolvePullShareToken \
  -H "Content-Type: application/json" \
  -d '{"data":{"shareToken":"<valid-token>"}}'

# Should return:
# {
#   "pull": { ... },
#   "clientId": "...",
#   "projectId": "..."
# }
```

Or visit a share link in an incognito browser:
```
https://um-shotbuilder.web.app/pulls/shared/<token>
```

---

## Related Files

- `/functions/index.js` - resolvePullShareToken function (lines 90-175)
- `/firebase.json` - Firebase Hosting rewrite configuration (lines 21-27)
- `/src/pages/PullPublicViewPage.jsx` - Frontend implementation
- `/docs/IMPROVEMENTS_PHASE1_SUMMARY.md` - Context about this security improvement

---

## Contact

For organization policy questions, contact your GCP organization administrator.

For technical questions about this implementation, contact: ted@immediategroup.ca

---

**Last Updated:** 2025-10-06
