# Complete Reset Procedure

## The Problem
Firestore established a WebSocket connection with your OLD token (before custom claims) and refuses to reconnect with the new token, even though your browser has it.

## Complete Reset Steps

### 1. Stop Dev Server
```bash
# Press Ctrl+C in terminal where npm run dev is running
```

### 2. Kill ALL Node processes (in case something is stuck)
```bash
killall node
```

### 3. Clear ALL browser data
In Chrome DevTools (F12):
- Application tab → Storage → Clear site data (check ALL boxes)
- Or run in console:
```javascript
localStorage.clear();
sessionStorage.clear();
caches.keys().then(keys => keys.forEach(key => caches.delete(key)));
indexedDB.databases().then(dbs => dbs.forEach(db => indexedDB.deleteDatabase(db.name)));
```

### 4. Close ALL browser tabs for localhost:5173

### 5. Restart computer (to clear any system DNS/network cache)

### 6. After restart, start fresh:
```bash
cd /Users/tedghanime/Documents/App\ Development/Shot\ Builder\ Development/shot-builder-workdir/shot-builder-app
npm run dev
```

### 7. Open NEW Incognito window
- Go to http://localhost:5173
- Sign in with Google
- Check if it works

## If This Still Doesn't Work

Then we have a deeper issue with how Firestore is initialized. We'll need to:
1. Add explicit Firestore termination/reconnection
2. Check if there's a service worker caching the connection
3. Verify the Firebase project settings in console
