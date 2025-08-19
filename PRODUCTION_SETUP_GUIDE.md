# 🚀 Production Setup Guide - Fix Demo Mode Issues

## ✅ **Issues Fixed in Code:**
1. Removed forced demo mode from AuthContext
2. Removed forced demo mode from Firebase queries
3. App now only uses demo mode when `?demo=true` is in URL

## 🔧 **Firebase Console Setup Required:**

### **Step 1: Enable Authentication Methods**
Go to [Firebase Console](https://console.firebase.google.com/project/um-shotbuilder/authentication/providers):

1. **Enable Google Sign-In:**
   - Click "Google" provider
   - Click "Enable"
   - Add your domain: `um-shotbuilder.firebaseapp.com`
   - Save

2. **Enable Email/Password:**
   - Click "Email/Password" provider
   - Enable both options
   - Save

### **Step 2: Deploy Firestore Rules & Cloud Functions**
Run these commands to deploy backend services:

```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules --project um-shotbuilder

# Deploy Cloud Functions (for user management & invitations)
firebase deploy --only functions --project um-shotbuilder

# Deploy Storage rules
firebase deploy --only storage --project um-shotbuilder
```

### **Step 3: Create Admin User**
After authentication is enabled:

1. Go to Authentication > Users in Firebase Console
2. Click "Add User"
3. Email: `ted@immediategroup.ca`
4. Set a temporary password
5. Save

### **Step 4: Set Admin Custom Claims**
In Firebase Console > Functions, call the `setUserRole` function:
```json
{
  "email": "ted@immediategroup.ca", 
  "role": "admin",
  "orgId": "unbound-merino"
}
```

## 🔄 **Redeploy the Fixed App:**

```bash
# Build with fixes
npm run build

# Deploy updated code
firebase deploy --project um-shotbuilder
```

## 📋 **After Setup, Test:**
1. Visit: https://um-shotbuilder.firebaseapp.com (no ?demo=true)
2. Click "Sign In" 
3. Use Google Sign-In or email/password
4. Should see real authentication working
5. Admin can invite users via email
6. Can create/edit real projects (not demo data)

## 🔍 **Debugging:**
- **Demo Mode**: Only active when URL contains `?demo=true`
- **Real Mode**: Default when visiting https://um-shotbuilder.firebaseapp.com
- **Check Console**: Look for Firebase auth/firestore errors in browser dev tools