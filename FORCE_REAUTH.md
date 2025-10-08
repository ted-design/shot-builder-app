# Force Complete Re-Authentication

The custom claims are set on the server, but your browser session isn't picking them up.

## Nuclear Option: Complete Sign Out from Firebase

Run these commands in your terminal:

```bash
# 1. Sign out from Firebase CLI
firebase logout

# 2. Sign back in
firebase login

# 3. Delete the user from Firebase Auth and re-create (only if absolutely necessary)
# DON'T DO THIS YET - try the browser steps first
```

## Browser: Complete Cache Clear

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Under **Storage**, click **Clear site data**
4. Check ALL boxes
5. Click **Clear site data**

6. Then run this in the console:
```javascript
// Force sign out and clear everything
localStorage.clear();
sessionStorage.clear();

// Delete all IndexedDB databases
indexedDB.databases().then(dbs => {
  dbs.forEach(db => {
    console.log('Deleting:', db.name);
    indexedDB.deleteDatabase(db.name);
  });

  setTimeout(() => {
    console.log('✅ All cleared! Reloading...');
    window.location.reload();
  }, 1000);
});
```

7. After reload, sign in with Google again

## Alternative: Use Incognito Mode

1. Open an Incognito/Private window
2. Go to http://localhost:5173
3. Sign in with Google
4. Check if it works there

If it works in Incognito but not in normal mode, it's definitely a cache issue.

## Last Resort: Re-run Setup Script

If nothing works, there might be an issue with how the claims were set. Re-run:

```bash
cd functions
node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino --project=um-shotbuilder
```

Then sign out and back in.
