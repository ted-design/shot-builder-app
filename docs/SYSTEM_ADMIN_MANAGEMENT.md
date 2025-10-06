# System Admin Management

## Overview

System admins have special privileges to manage user roles and claims via Cloud Functions. This system uses a Firestore collection (`systemAdmins`) to manage who can perform administrative operations, replacing the hardcoded admin email approach.

## Architecture

### Authorization Hierarchy

1. **System Admins** (highest level)
   - Stored in `/systemAdmins` collection
   - Can assign roles and claims to any user
   - Managed via Admin SDK scripts
   - Fallback: Environment variable `SUPER_ADMIN_EMAIL`

2. **Client Admins** (per-client level)
   - Have `role: 'admin'` custom claim
   - Can manage users within their client/org
   - Assigned by system admins

3. **Project Roles** (project level)
   - Producer, Wardrobe, Crew, Viewer
   - Scoped to specific projects

### Firestore Collection Structure

```
/systemAdmins/{email}
  - email: string (same as document ID)
  - enabled: boolean
  - addedAt: timestamp
  - addedBy: string (email or "script")
```

### Cloud Function Flow

When `setUserClaims` is called:

1. Authenticate the caller via Firebase Auth
2. Check if caller email exists in `/systemAdmins` with `enabled: true`
3. If not found, check environment variable `SUPER_ADMIN_EMAIL`
4. If authorized, set custom claims on target user
5. Revoke target user's refresh tokens to force claim update

## Setup Guide

### Initial Bootstrap

When deploying for the first time, you need to bootstrap the first system admin:

#### Option 1: Using Admin Script (Recommended)

1. **Set up service account credentials:**
   ```bash
   cd functions
   # Download service account key from Firebase Console:
   # Project Settings > Service Accounts > Generate New Private Key
   # Save as functions/service-account.json
   ```

2. **Add to .gitignore:**
   ```bash
   echo "functions/service-account.json" >> .gitignore
   ```

3. **Run the bootstrap script:**
   ```bash
   cd functions
   node scripts/manage-system-admins.js add your-email@example.com
   ```

#### Option 2: Using Firebase Console

1. Go to Firebase Console → Firestore Database
2. Create a collection called `systemAdmins`
3. Add a document with ID = your email address
4. Add fields:
   ```
   email: your-email@example.com
   enabled: true
   addedAt: (current timestamp)
   addedBy: "console"
   ```

#### Option 3: Using Fallback Super Admin

1. Set environment variable in Firebase Functions:
   ```bash
   firebase functions:config:set admin.super_email="your-email@example.com"
   ```

2. Update functions/index.js:
   ```javascript
   const FALLBACK_SUPER_ADMIN = functions.config().admin?.super_email || "ted@immediategroup.ca";
   ```

3. Redeploy functions:
   ```bash
   firebase deploy --only functions
   ```

## Managing System Admins

### Using the Management Script

```bash
cd functions

# Add a new system admin
node scripts/manage-system-admins.js add email@example.com

# List all system admins
node scripts/manage-system-admins.js list

# Disable a system admin (keeps record but revokes access)
node scripts/manage-system-admins.js disable email@example.com

# Re-enable a disabled system admin
node scripts/manage-system-admins.js enable email@example.com

# Permanently remove a system admin
node scripts/manage-system-admins.js remove email@example.com
```

### Using Firestore Console

1. Navigate to Firestore → `systemAdmins` collection
2. To add: Click "Add Document", use email as ID
3. To disable: Edit document, set `enabled: false`
4. To remove: Delete the document

## Security Considerations

### Firestore Rules

The `systemAdmins` collection has strict security rules:

```javascript
match /systemAdmins/{email} {
  allow read: if isSystemAdmin();  // Only system admins can see the list
  allow write: if false;            // Only Admin SDK can write
}
```

This prevents:
- Regular users from seeing who the system admins are
- Client-side code from modifying system admin status
- Accidental or malicious privilege escalation

### Best Practices

1. **Minimum Necessary Admins:**
   - Keep the number of system admins as small as possible
   - Typically 1-3 people maximum

2. **Use Disable, Not Delete:**
   - When an admin leaves, disable their account rather than deleting
   - Maintains audit trail
   - Can be re-enabled if needed

3. **Regular Audits:**
   - Periodically review the list of system admins
   - Remove or disable accounts that are no longer needed

4. **Secure Service Account Key:**
   - Never commit `service-account.json` to version control
   - Store securely and limit access
   - Rotate periodically

5. **Environment Variable for Production:**
   - Use Firebase Functions config or Secret Manager for `SUPER_ADMIN_EMAIL`
   - Don't rely on hardcoded values in production

## Troubleshooting

### "Not authorized" Error When Calling setUserClaims

**Cause:** Caller's email is not in the `systemAdmins` collection with `enabled: true`.

**Solutions:**
1. Check if the email exists in Firestore:
   ```bash
   node scripts/manage-system-admins.js list
   ```

2. Verify the email matches exactly (case-sensitive):
   ```javascript
   // In Firestore
   email: "user@example.com"

   // Caller's auth token
   auth.token.email: "User@example.com"  // ❌ Won't match
   ```

3. Check if account is disabled:
   ```bash
   node scripts/manage-system-admins.js enable your-email@example.com
   ```

### Service Account Script Not Working

**Error:** `ENOENT: no such file or directory, open '../service-account.json'`

**Solution:**
1. Download service account key from Firebase Console
2. Save as `functions/service-account.json`
3. Verify file exists:
   ```bash
   ls -la functions/service-account.json
   ```

### Cloud Function Returns "Not authorized" Even for Valid Admin

**Possible Causes:**

1. **Firestore rules block access:**
   - Ensure Firestore rules allow Cloud Functions (Admin SDK) to read/write
   - Admin SDK bypasses Firestore rules by default

2. **Cached authentication token:**
   - User's token may be cached and not reflect latest changes
   - Ask user to sign out and sign back in
   - Or call `auth.currentUser.getIdToken(true)` to force refresh

3. **Function not redeployed:**
   - Changes to function code require redeployment
   ```bash
   firebase deploy --only functions
   ```

## Migration from Hardcoded Admin

If you're migrating from the old hardcoded `ALLOWED_ADMINS` Set:

1. **Bootstrap the systemAdmins collection:**
   ```bash
   # Add current hardcoded admins
   node scripts/manage-system-admins.js add ted@immediategroup.ca
   ```

2. **Test the new system:**
   - Verify you can still call `setUserClaims` function
   - Check logs for any errors

3. **Update environment variable (optional):**
   ```bash
   firebase functions:config:set admin.super_email="ted@immediategroup.ca"
   ```

4. **The hardcoded fallback still exists** for backward compatibility

## Monitoring & Auditing

### Check Who Modified Claims

Cloud Functions logs all claim modifications:

```javascript
// In Cloud Functions logs (Firebase Console → Functions → Logs)
// Search for: "setUserClaims"
```

### Audit System Admin Changes

Since system admins can only be modified via Admin SDK, check:

1. **Script usage:** Check who has access to service account key
2. **Console access:** Check Firebase Console audit logs
3. **Firestore history:** Use Firestore data export to see historical changes

### Set Up Alerts

Create alerts for system admin changes:

```javascript
// Cloud Function to monitor systemAdmins collection
exports.auditSystemAdmins = functions.firestore
  .document('systemAdmins/{email}')
  .onWrite((change, context) => {
    const email = context.params.email;
    const before = change.before.data();
    const after = change.after.data();

    console.log(`System admin change for ${email}:`, {
      before,
      after,
      timestamp: new Date().toISOString()
    });

    // Send email/Slack notification to security team
    // ...
  });
```

## Reference

### Related Files

- `/functions/index.js` - Cloud Function implementation
- `/functions/scripts/manage-system-admins.js` - Management script
- `/firestore.rules` - Security rules for systemAdmins collection
- `/docs/BACKUP_SETUP.md` - Backup strategy (includes systemAdmins)

### Cloud Function API

**Function Name:** `setUserClaims`

**Input:**
```typescript
{
  targetEmail: string;  // Email of user to modify
  role: "admin" | "producer" | "crew" | "warehouse" | "viewer" | "editor";
  clientId: string;     // Client/org ID for the user
}
```

**Output:**
```typescript
{
  ok: true;
  uid: string;         // Firebase Auth UID of target user
  claims: {            // New custom claims
    role: string;
    clientId: string;
  }
}
```

**Errors:**
- `"Not authorized."` - Caller is not a system admin
- `"Authentication required."` - No auth token provided
- `"Invalid input. Provide targetEmail, role, clientId."` - Missing required fields
- `"Firebase: Error (auth/user-not-found)."` - Target email doesn't exist

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SUPER_ADMIN_EMAIL` | Fallback super admin email | `ted@immediategroup.ca` |

### Firestore Indexes

No composite indexes required for `systemAdmins` collection (simple document reads by email).

## Support

For issues with system admin management:
- Check Cloud Functions logs in Firebase Console
- Review Firestore security rules
- Verify service account permissions
- Contact: ted@immediategroup.ca
