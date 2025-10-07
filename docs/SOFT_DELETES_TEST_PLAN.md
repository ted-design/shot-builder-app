# Soft Deletes - Production Testing Checklist

**Date:** 2025-10-06
**Environment:** Production (https://um-shotbuilder.web.app)
**Tester:** _______________
**Status:** [ ] Not Started / [ ] In Progress / [ ] Complete

---

## Pre-Test Verification

### Indexes Status
- [x] Firestore indexes deployed
- [x] New shots index: `(projectId, deleted, date)` ✅
- [x] New SKUs index: `(deleted, colorName)` ✅
- [ ] Application accessible at https://um-shotbuilder.web.app
- [ ] Login successful as admin user

---

## Test 1: Products - Soft Delete

**Objective:** Verify products are soft deleted, not permanently removed

### Steps:
1. [ ] Navigate to Products page
2. [ ] Note the total number of products displayed: _______
3. [ ] Select a test product (preferably a non-critical one)
4. [ ] Record product details:
   - Product name: _______________________
   - Style number: _______________________
   - Product ID (from URL/console): _______________________

### Delete Product:
5. [ ] Click the "..." menu on the product
6. [ ] Click "Edit family"
7. [ ] Scroll to bottom of edit modal
8. [ ] Type product name to confirm deletion
9. [ ] Click "Delete Product Family"
10. [ ] Verify toast notification appears with success message

### Verify Soft Delete:
11. [ ] **Product disappears from Products page** ✅ Expected
12. [ ] Total product count decreased by 1: _______
13. [ ] Open browser DevTools → Console
14. [ ] Run this query in console:
```javascript
// Replace YOUR_CLIENT_ID and PRODUCT_ID with actual values
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('productFamilies').doc('PRODUCT_ID')
  .get().then(doc => {
    console.log('Product data:', doc.data());
    console.log('Deleted flag:', doc.data()?.deleted);
    console.log('DeletedAt:', doc.data()?.deletedAt);
  });
```

15. [ ] Verify console shows:
   - `deleted: true` ✅
   - `deletedAt: <timestamp>` ✅
   - Product data still exists ✅
   - Images still present ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 2: Products - Restore Deleted Product

**Objective:** Verify admins can restore soft-deleted products

### Prerequisites:
- Must be logged in as admin
- Must have a soft-deleted product from Test 1

### Steps:
1. [ ] **Current state:** Product is deleted and not visible in Products page
2. [ ] Open browser DevTools → Console
3. [ ] Temporarily enable "Show Deleted" by modifying filter:
```javascript
// In the Products page, open React DevTools
// Find the ProductsPage component state
// OR manually query the deleted product
```

**Alternative Method (Manual Database Query):**
4. [ ] Open Firebase Console → Firestore
5. [ ] Navigate to: `clients/{clientId}/productFamilies/{productId}`
6. [ ] Verify `deleted: true`
7. [ ] Change `deleted` to `false` manually
8. [ ] Change `deletedAt` to `null` manually
9. [ ] Refresh Products page
10. [ ] **Product should reappear** ✅ Expected

**Automated Restore (if UI implemented):**
- [ ] Find deleted product in UI
- [ ] Click "..." menu
- [ ] Click "Restore from deleted" (green button)
- [ ] Verify toast notification
- [ ] Product reappears in list ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 3: Shots - Soft Delete

**Objective:** Verify shots are soft deleted with server-side filtering

### Steps:
1. [ ] Navigate to Shots page (select any project)
2. [ ] Note the total number of shots displayed: _______
3. [ ] Select a test shot (preferably a non-critical one)
4. [ ] Record shot details:
   - Shot name: _______________________
   - Shot ID (from console): _______________________

### Delete Shot:
5. [ ] Click the "Delete" button/icon on the shot
6. [ ] Confirm deletion in the confirmation dialog
7. [ ] Verify toast notification appears

### Verify Soft Delete:
8. [ ] **Shot disappears from Shots page** ✅ Expected
9. [ ] Total shot count decreased by 1: _______
10. [ ] Open browser DevTools → Console
11. [ ] Run this query in console:
```javascript
// Replace YOUR_CLIENT_ID and SHOT_ID with actual values
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('shots').doc('SHOT_ID')
  .get().then(doc => {
    console.log('Shot data:', doc.data());
    console.log('Deleted flag:', doc.data()?.deleted);
    console.log('DeletedAt:', doc.data()?.deletedAt);
  });
```

12. [ ] Verify console shows:
   - `deleted: true` ✅
   - `deletedAt: <timestamp>` ✅
   - Shot data still exists ✅

### Verify Server-Side Filtering:
13. [ ] Open DevTools → Network tab
14. [ ] Filter for Firestore requests
15. [ ] Look for query with `where("deleted", "==", false)`
16. [ ] Verify deleted shot is NOT returned in query results ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 4: Shots - Restore Deleted Shot

**Objective:** Verify shots can be restored from deletion

### Prerequisites:
- Must have a soft-deleted shot from Test 3

### Steps:
1. [ ] Open Firebase Console → Firestore
2. [ ] Navigate to: `clients/{clientId}/shots/{shotId}`
3. [ ] Verify `deleted: true`
4. [ ] Change `deleted` to `false`
5. [ ] Change `deletedAt` to `null`
6. [ ] Refresh Shots page
7. [ ] **Shot should reappear** ✅ Expected
8. [ ] Verify shot is fully functional (can edit, view, etc.)

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 5: New Product Creation

**Objective:** Verify new products have deleted fields set correctly

### Steps:
1. [ ] Navigate to Products page
2. [ ] Click "Create Product Family"
3. [ ] Fill in required fields:
   - Style name: "Test Product - Soft Delete"
   - Style number: "SD-TEST-001"
   - Gender: Select any
   - Add at least one SKU
4. [ ] Save product
5. [ ] Verify product appears in Products page
6. [ ] Open browser DevTools → Console
7. [ ] Find the new product ID
8. [ ] Run this query:
```javascript
// Replace YOUR_CLIENT_ID and PRODUCT_ID
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('productFamilies').doc('PRODUCT_ID')
  .get().then(doc => {
    console.log('New product deleted flag:', doc.data()?.deleted);
    console.log('New product deletedAt:', doc.data()?.deletedAt);
  });
```

9. [ ] Verify console shows:
   - `deleted: false` ✅
   - `deletedAt: null` ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 6: New Shot Creation

**Objective:** Verify new shots have deleted fields set correctly

### Steps:
1. [ ] Navigate to Shots page
2. [ ] Click "Create Shot" or add new shot
3. [ ] Fill in required fields:
   - Name: "Test Shot - Soft Delete"
   - Date: Today's date
   - Add at least one product
4. [ ] Save shot
5. [ ] Verify shot appears in Shots page
6. [ ] Run this query in console:
```javascript
// Replace YOUR_CLIENT_ID and SHOT_ID
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('shots').doc('SHOT_ID')
  .get().then(doc => {
    console.log('New shot deleted flag:', doc.data()?.deleted);
    console.log('New shot deletedAt:', doc.data()?.deletedAt);
  });
```

7. [ ] Verify console shows:
   - `deleted: false` ✅
   - `deletedAt: null` ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 7: SKU Soft Delete (Advanced)

**Objective:** Verify SKUs are soft deleted when removed from product family

### Steps:
1. [ ] Navigate to Products page
2. [ ] Select a product with multiple SKUs
3. [ ] Click "Edit family"
4. [ ] Note the number of SKUs: _______
5. [ ] Remove one SKU (click X or remove button)
6. [ ] Save changes
7. [ ] Open Firebase Console → Firestore
8. [ ] Navigate to: `clients/{clientId}/productFamilies/{familyId}/skus/{skuId}`
9. [ ] Verify the removed SKU:
   - `deleted: true` ✅
   - `deletedAt: <timestamp>` ✅
   - SKU data still exists ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 8: Batch Delete Products

**Objective:** Verify batch delete operation uses soft deletes

### Steps:
1. [ ] Navigate to Products page
2. [ ] Select 2-3 test products using checkboxes
3. [ ] Note selected count: _______
4. [ ] Click "Delete" batch action button
5. [ ] Confirm deletion
6. [ ] Verify toast notification shows success
7. [ ] **All selected products disappear** ✅ Expected
8. [ ] Verify in Firestore Console that all products have:
   - `deleted: true` ✅
   - `deletedAt: <timestamp>` ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 9: Query Performance

**Objective:** Verify queries are efficient with deleted field

### Steps:
1. [ ] Open DevTools → Network tab
2. [ ] Navigate to Shots page
3. [ ] Look for Firestore query requests
4. [ ] Verify query includes `where("deleted", "==", false)`
5. [ ] Note query response time: _______ ms
6. [ ] Verify no console errors related to missing indexes
7. [ ] Navigate to Products page
8. [ ] Verify Products page loads without errors
9. [ ] Note load time: _______ ms

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Test 10: Regression Testing

**Objective:** Verify existing functionality still works

### Edit Product:
1. [ ] Edit a non-deleted product
2. [ ] Change style name
3. [ ] Add/remove SKU
4. [ ] Change thumbnail image
5. [ ] Save changes
6. [ ] Verify changes persist ✅

### Edit Shot:
7. [ ] Edit a non-deleted shot
8. [ ] Change shot name
9. [ ] Add/remove product
10. [ ] Save changes
11. [ ] Verify changes persist ✅

### Archive/Unarchive:
12. [ ] Archive a product
13. [ ] Enable "Show Archived" toggle
14. [ ] Unarchive the product
15. [ ] Verify archived functionality unchanged ✅

**Result:** [ ] PASS / [ ] FAIL
**Notes:** _______________________________________________

---

## Critical Issues Found

**Issue #1:**
- Description: _______________________________________________
- Severity: [ ] Critical / [ ] High / [ ] Medium / [ ] Low
- Steps to reproduce: _______________________________________________
- Expected: _______________________________________________
- Actual: _______________________________________________

**Issue #2:**
- Description: _______________________________________________
- Severity: [ ] Critical / [ ] High / [ ] Medium / [ ] Low
- Steps to reproduce: _______________________________________________
- Expected: _______________________________________________
- Actual: _______________________________________________

---

## Test Summary

**Total Tests:** 10
**Passed:** _______
**Failed:** _______
**Blocked:** _______

**Overall Status:** [ ] ALL PASS / [ ] ISSUES FOUND

**Recommendation:**
- [ ] ✅ Production ready - no issues
- [ ] ⚠️ Minor issues - deploy with monitoring
- [ ] ❌ Critical issues - rollback required

**Tester Signature:** _______________
**Date Completed:** _______________
**Time Spent:** _______ minutes

---

## Quick Reference: Console Queries

### Check if product is soft deleted:
```javascript
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('productFamilies').doc('PRODUCT_ID')
  .get().then(doc => console.log(doc.data()));
```

### Check if shot is soft deleted:
```javascript
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('shots').doc('SHOT_ID')
  .get().then(doc => console.log(doc.data()));
```

### List all deleted products:
```javascript
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('productFamilies')
  .where('deleted', '==', true)
  .get().then(snap => {
    console.log(`Found ${snap.size} deleted products`);
    snap.forEach(doc => console.log(doc.data()));
  });
```

### List all deleted shots:
```javascript
firebase.firestore()
  .collection('clients').doc('YOUR_CLIENT_ID')
  .collection('shots')
  .where('deleted', '==', true)
  .get().then(snap => {
    console.log(`Found ${snap.size} deleted shots`);
    snap.forEach(doc => console.log(doc.data()));
  });
```
