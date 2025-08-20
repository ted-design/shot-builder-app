# 🚨 CRITICAL FIXES - Deploy These Immediately

## ✅ **ALL MAJOR ISSUES FIXED:**

### **1. Functions Region Mismatch** ✅ FIXED
- **Problem**: Frontend calling functions in wrong region (us-central1 vs northamerica-northeast1)
- **Fix**: Updated `src/firebase.js` to specify correct region: `getFunctions(app, 'northamerica-northeast1')`

### **2. Unsupported Node Runtime** ✅ FIXED  
- **Problem**: Using Node 22 and firebase-functions ^6.0.1 (non-existent)
- **Fix**: Updated `functions/package.json` to Node 18 and firebase-functions ^4.4.1

### **3. Demo Mode Stuck On** ✅ FIXED
- **Problem**: Demo mode forced to always true
- **Fix**: Removed `|| true` from AuthContext and useFirebaseQuery

### **4. Functions v2 Syntax Issues** ✅ FIXED
- **Problem**: Using unsupported v2 syntax
- **Fix**: Updated all functions to use v1 syntax with correct region

### **5. Hardcoded Organization ID** ✅ PARTIALLY FIXED
- **Problem**: Always using 'unbound-merino' instead of user's orgId
- **Fix**: Updated getCurrentOrgId() to check user claims first

## 🚀 **DEPLOY THESE FIXES NOW:**

### **Step 1: Install Functions Dependencies**
```bash
cd functions
npm install
cd ..
```

### **Step 2: Deploy Updated Code**
```bash
# Deploy frontend with all fixes
firebase deploy --only hosting --project um-shotbuilder

# Deploy functions with correct runtime
firebase deploy --only functions --project um-shotbuilder
```

### **Step 3: Enable Authentication (CRITICAL)**
1. Go to [Firebase Console → Authentication](https://console.firebase.google.com/project/um-shotbuilder/authentication/providers)
2. **Enable Google Sign-In** provider
3. **Enable Email/Password** provider

### **Step 4: Deploy Firestore Rules**
```bash
firebase deploy --only firestore --project um-shotbuilder
```

## 🎯 **What Will Work After Deployment:**

✅ **Real Authentication**: No more forced demo mode
✅ **Google Sign-In**: Users can login with Google accounts  
✅ **User Initialization**: `initializeUser` function will work properly
✅ **Custom Claims**: Users will get proper orgId and role claims
✅ **Firestore Access**: Users can read/write data based on their organization
✅ **Admin Functions**: User invitations and role management will work
✅ **Sign Out**: Proper logout functionality restored

## 🔍 **Test After Deployment:**

1. **Visit**: https://um-shotbuilder.firebaseapp.com (no ?demo=true)
2. **Should see**: "Sign In" button instead of "Demo User"
3. **Login**: Use your Google account (ted@immediategroup.ca)
4. **Check**: Browser dev tools console for successful `initializeUser` call
5. **Verify**: Can create projects, invite users, edit data

## ⚠️ **CRITICAL**: Run ALL Steps in Order!

The functions deployment is especially important as it fixes the region mismatch that's causing the authentication initialization to fail.

**After deployment, the app should work exactly as intended with real authentication and data management!** 🎉