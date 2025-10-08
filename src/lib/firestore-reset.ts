/**
 * Firestore Connection Reset Utility
 *
 * This module provides utilities to force Firestore to completely
 * disconnect and reconnect with fresh authentication tokens.
 */

import { terminate, clearIndexedDbPersistence } from 'firebase/firestore';
import { db, auth } from './firebase';

/**
 * Completely terminate and reset Firestore connection
 * Use this when custom claims are updated and Firestore needs to reconnect
 */
export async function resetFirestoreConnection(): Promise<void> {
  console.log('🔄 [Firestore] Starting connection reset...');

  try {
    // Step 1: Terminate existing Firestore instance
    await terminate(db);
    console.log('✅ [Firestore] Terminated existing connection');

    // Step 2: Clear IndexedDB persistence cache
    try {
      await clearIndexedDbPersistence(db);
      console.log('✅ [Firestore] Cleared persistence cache');
    } catch (err: any) {
      // This will fail if Firestore is still active, which is OK
      console.warn('⚠️  [Firestore] Could not clear persistence (expected if in use)');
    }

    // Step 3: Force auth token refresh
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
      console.log('✅ [Firestore] Refreshed auth token');
    }

    console.log('✅ [Firestore] Connection reset complete. Reload the page to reconnect.');

    // Step 4: Reload the page to establish fresh connection
    window.location.reload();

  } catch (error) {
    console.error('❌ [Firestore] Reset failed:', error);
    throw error;
  }
}

/**
 * Check if Firestore can see authentication
 */
export async function testFirestoreAuth(): Promise<{
  isAuthenticated: boolean;
  hasCustomClaims: boolean;
  canAccessFirestore: boolean;
  error?: any;
}> {
  const result = {
    isAuthenticated: false,
    hasCustomClaims: false,
    canAccessFirestore: false,
    error: undefined as any,
  };

  try {
    // Check if authenticated
    if (!auth.currentUser) {
      return result;
    }
    result.isAuthenticated = true;

    // Check if has custom claims
    const tokenResult = await auth.currentUser.getIdTokenResult(true);
    const claims = tokenResult.claims;
    result.hasCustomClaims = !!(claims.role && claims.clientId);

    // Try to access Firestore
    const { doc, getDoc } = await import('firebase/firestore');
    const clientId = claims.clientId || 'unbound-merino';
    const testDoc = doc(db, `clients/${clientId}/users/${auth.currentUser.uid}`);

    await getDoc(testDoc);
    result.canAccessFirestore = true;

  } catch (error) {
    result.error = error;
  }

  return result;
}
