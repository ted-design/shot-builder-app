# User Profile Setup Guide

This guide walks you through creating your user profile in Firestore to resolve "Missing or insufficient permissions" errors.

## Prerequisites

You need a Firebase service account key to run the setup script with admin privileges.

### Option 1: Using Firebase CLI (Recommended)

The easiest way is to use the Firebase CLI which automatically handles authentication:

```bash
# Make sure you're logged in to Firebase CLI
firebase login

# Set your project
firebase use um-shotbuilder

# Run the setup script with Firebase CLI authentication
cd functions
GOOGLE_APPLICATION_CREDENTIALS=<path-to-service-account> node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino
```

### Option 2: Download Service Account Key

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **um-shotbuilder**
3. Click the gear icon ⚙️ → **Project settings**
4. Go to **Service accounts** tab
5. Click **Generate new private key**
6. Save the file as `service-account.json` in the `functions/` directory
7. **⚠️ IMPORTANT**: Add `service-account.json` to `.gitignore` (already done)

## Setup Steps

### Step 1: Get Your Firebase UID (Optional)

If you want to verify your UID before running the script, paste this in your browser console while signed in:

```javascript
// Open browser console (F12) on http://localhost:5173
firebase.auth().currentUser.getIdTokenResult().then(idTokenResult => {
  console.log('Auth Token Claims:', {
    uid: firebase.auth().currentUser.uid,
    email: firebase.auth().currentUser.email,
    claims: idTokenResult.claims
  });
});
```

### Step 2: Run the Setup Script

From the root of the project:

```bash
cd functions
node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino
```

Or if you already have your UID:

```bash
cd functions
node scripts/setup-user.js --uid=YOUR_UID --role=admin --clientId=unbound-merino
```

### Step 3: Sign Out and Sign Back In

**This is critical!** Your browser still has the old auth token without the custom claims.

1. In your app, click **Sign Out**
2. Click **Sign In** again
3. The permission errors should now be gone ✅

## What This Script Does

1. ✅ Looks up your user by email (or uses UID if provided)
2. ✅ Sets custom claims on your auth token:
   - `role: "admin"`
   - `clientId: "unbound-merino"`
3. ✅ Revokes your current tokens (forces refresh on next sign-in)
4. ✅ Creates your user profile document at:
   ```
   /clients/unbound-merino/users/{yourUID}
   ```
5. ✅ Sets the document fields:
   - `email`: ted@immediategroup.ca
   - `displayName`: Your display name
   - `role`: admin
   - `projects`: {}
   - `createdAt`: timestamp
   - `updatedAt`: timestamp

## Troubleshooting

### Error: "Missing project id"

Set the environment variable or pass it explicitly:

```bash
FIREBASE_PROJECT_ID=um-shotbuilder node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino
```

Or:

```bash
node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino --project=um-shotbuilder
```

### Error: "Could not load the default credentials"

You need to set up authentication. Either:

1. Download the service account key (see Option 2 above) and run:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino
   ```

2. Or use `gcloud auth application-default login`:
   ```bash
   gcloud auth application-default login
   ```

### Still getting permission errors after sign-in?

1. Open browser DevTools → Application → Storage
2. Clear all site data
3. Refresh the page
4. Sign in again

## User Roles

Available roles:
- `admin` - Full access to everything
- `producer` - Can manage projects, shots, pulls
- `editor` - Can edit shots, limited access
- `viewer` - Read-only access

## Security

The Firestore security rules require:
- Users can only read their own profile and other users in their client
- Custom claims (`clientId` and `role`) are used for authorization
- The `AuthContext` component will automatically create missing user profiles when the user signs in (if they have valid custom claims)

## Next Steps

After successful setup, you can:
1. View your user profile in Firebase Console → Firestore
2. Navigate to: `clients/unbound-merino/users/{yourUID}`
3. Verify all fields are present
4. Start using the app without permission errors! 🎉
