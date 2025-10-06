# Troubleshooting 404 Image Errors

## Issue
Console shows 404 errors for missing product images:
```
GET https://firebasestorage.googleapis.com/v0/b/um-shotbuilder.firebasestorage.app/o/images%2F... 404 (Not Found)
```

## Root Causes

### 1. Wrong Storage Bucket Domain
Firebase Storage changed domains. Old URLs used `firebasestorage.googleapis.com`, new URLs use `firebasestorage.app`.

**Check your `.env` file:**
```bash
# Old (deprecated)
VITE_FIREBASE_STORAGE_BUCKET=um-shotbuilder.appspot.com

# New (correct)
VITE_FIREBASE_STORAGE_BUCKET=um-shotbuilder.firebasestorage.app
```

### 2. Missing Product Images
Products have image paths in Firestore, but files don't exist in Storage.

**This happens when:**
- Product created but image upload failed
- Image manually deleted from Storage
- Product imported without images

## Solutions

### Quick Fix: Update Storage Bucket Domain

1. **Check current configuration:**
   ```bash
   cat .env | grep STORAGE_BUCKET
   ```

2. **Update if using old domain:**
   ```bash
   # In .env file
   VITE_FIREBASE_STORAGE_BUCKET=um-shotbuilder.firebasestorage.app
   ```

3. **Rebuild and redeploy:**
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Deep Fix: Audit and Fix Missing Images

#### Step 1: Find Products with Missing Images

Create a script: `functions/scripts/audit-missing-images.js`

```javascript
const admin = require("firebase-admin");
const serviceAccount = require("../service-account.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const storage = admin.storage().bucket();

async function auditImages() {
  const clientsSnapshot = await db.collection("clients").get();

  for (const clientDoc of clientsSnapshot.docs) {
    const familiesSnapshot = await db
      .collection("clients")
      .doc(clientDoc.id)
      .collection("productFamilies")
      .get();

    console.log(`\nAuditing client: ${clientDoc.id}`);

    for (const familyDoc of familiesSnapshot.docs) {
      const family = familyDoc.data();

      // Check family thumbnail
      if (family.thumbnailImagePath) {
        const [exists] = await storage.file(family.thumbnailImagePath).exists();
        if (!exists) {
          console.log(`❌ Missing: ${family.styleName} thumbnail`);
          console.log(`   Path: ${family.thumbnailImagePath}`);
          console.log(`   Doc: clients/${clientDoc.id}/productFamilies/${familyDoc.id}`);
        }
      }

      // Check SKU images
      const skusSnapshot = await familyDoc.ref.collection("skus").get();
      for (const skuDoc of skusSnapshot.docs) {
        const sku = skuDoc.data();
        if (sku.imagePath) {
          const [exists] = await storage.file(sku.imagePath).exists();
          if (!exists) {
            console.log(`❌ Missing: ${family.styleName} - ${sku.colorName} SKU image`);
            console.log(`   Path: ${sku.imagePath}`);
          }
        }
      }
    }
  }

  console.log("\n✅ Audit complete");
  process.exit(0);
}

auditImages().catch(console.error);
```

**Run it:**
```bash
cd functions
node scripts/audit-missing-images.js > missing-images-report.txt
```

#### Step 2: Fix Missing Images

**Option A: Remove Broken References (Quick)**
Update Firestore documents to remove `imagePath` fields for missing files.

**Option B: Re-upload Images (Better)**
1. Get product images from source (e.g., Unbound Merino website)
2. Upload via app UI or script

#### Step 3: Prevent Future Issues

Add validation to product upload:
```javascript
// In ProductForm.jsx or upload handler
async function uploadProductImage(file, productId) {
  try {
    const result = await uploadImageFile(file, {
      folder: "productFamilies",
      id: productId
    });

    // Verify upload succeeded
    const [exists] = await storage.file(result.path).exists();
    if (!exists) {
      throw new Error("Image upload verification failed");
    }

    return result;
  } catch (error) {
    console.error("Image upload failed:", error);
    // Don't save imagePath to Firestore if upload failed
    throw error;
  }
}
```

## Monitoring

### Check Storage Usage
```bash
firebase storage:get-usage
```

### List All Images
```bash
gsutil ls -r gs://um-shotbuilder.firebasestorage.app/images/
```

### Check CORS Configuration
```bash
gsutil cors get gs://um-shotbuilder.firebasestorage.app
```

## Related Issues

### AppImage Component Already Handles 404s Gracefully

The `AppImage` component has built-in retry logic:
- Retries failed loads 3 times
- Shows fallback/placeholder on failure
- Logs errors to console

**File:** `src/components/common/AppImage.tsx`

No user-facing error occurs - just console warnings.

## Prevention Checklist

- [ ] Use correct storage bucket domain in `.env`
- [ ] Validate image uploads succeed before saving paths
- [ ] Add error handling to image upload flows
- [ ] Periodically audit for orphaned references
- [ ] Consider adding default placeholder images

## Support

For assistance:
- Check Firebase Storage console: https://console.firebase.google.com/project/um-shotbuilder/storage
- Review AppImage component logs in browser console
- Contact: ted@immediategroup.ca
