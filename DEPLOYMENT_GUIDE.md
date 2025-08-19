# 🚀 UM-ShotBuilder Deployment Guide

## ✅ Project Status
Your Unbound Merino Shot Builder app is ready for deployment! Here's what's been completed:

### 🎯 Features Implemented
- ✅ **PDF Export System**: Complete shot list and inventory PDF generation
- ✅ **Kanban Workflow**: Drag-and-drop shot management
- ✅ **Firebase Integration**: Authentication, Firestore, Cloud Functions
- ✅ **Modern React Architecture**: Vite, TanStack Query, React Hook Form, Zod
- ✅ **Professional UI**: Tailwind CSS + shadcn/ui components
- ✅ **Demo Mode**: Fully functional with mock data for testing

### 📁 Project Structure
```
/app/
├── dist/                 # Built production files (ready to deploy)
├── src/                 # React source code
├── functions/           # Firebase Cloud Functions
├── firebase.json        # Firebase configuration
├── .firebaserc         # Project configuration (um-shotbuilder)
└── package.json        # Dependencies and scripts
```

## 🔧 Updated Configuration

### Firebase Config (`src/firebase.js`)
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAMghXkbPHuHSpzWHYinKnv8f2F_-YI0",
  authDomain: "um-shotbuilder.firebaseapp.com",
  projectId: "um-shotbuilder",
  storageBucket: "um-shotbuilder.appspot.com",
  messagingSenderId: "16806541847",
  appId: "1:16806541847:web:be45c7303aa6f8aff4e712",
  measurementId: "G-0M8WVWZ7PE",
};
```

## 🚀 Deployment Steps

### 1. Authentication Required
```bash
firebase login
```
*This will open a browser for Google authentication*

### 2. Deploy Everything
```bash
cd /app
firebase deploy --project um-shotbuilder
```

### 3. Deploy Only Hosting (if needed)
```bash
firebase deploy --only hosting --project um-shotbuilder
```

### 4. Deploy Only Functions (if needed)
```bash
firebase deploy --only functions --project um-shotbuilder
```

## 📋 Pre-Deployment Checklist
- ✅ Firebase project created (um-shotbuilder)
- ✅ Firebase config updated with your credentials
- ✅ Production build completed (`yarn build`)
- ✅ Cloud Functions configured
- ✅ Hosting configuration set to serve from `dist/`
- ✅ All features tested and working

## 🌐 After Deployment
Once deployed, your app will be available at:
- **Hosting URL**: https://um-shotbuilder.firebaseapp.com
- **Custom Domain**: Can be configured in Firebase Console

## 🔒 Firebase Services Setup
1. **Authentication**: Enable Google Sign-in in Firebase Console
2. **Firestore**: Set up security rules (already configured)
3. **Storage**: Enable for image uploads
4. **Functions**: Deployed for user management

## 📧 Admin Configuration
The admin email is set to: `ted@immediategroup.ca`
This user can manage roles and organizations through the Cloud Functions.

## 🎨 Features Available
1. **Shot Management**: Create, edit, organize shots in Kanban board
2. **PDF Export**: Generate professional shot lists and inventory reports
3. **Pull Requests**: Manage warehouse requests with fulfillment tracking
4. **Product Catalog**: Manage products with search and filtering
5. **Talent & Locations**: Organize shoot resources
6. **Role-Based Access**: Admin, Producer, Editor, Viewer, Catalog, Warehouse roles

## 🐛 Troubleshooting
- If authentication issues: Check Firebase Console > Authentication > Sign-in methods
- If Firestore errors: Verify security rules are deployed
- If Functions fail: Check logs in Firebase Console > Functions

Your app is production-ready! 🎉