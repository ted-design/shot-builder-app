#!/usr/bin/env node

/**
 * User Profile Setup Script
 *
 * This script sets up a complete user profile including:
 * 1. Setting custom claims (clientId and role)
 * 2. Creating the user profile document in Firestore
 *
 * Usage:
 *   node scripts/setup-user.js --email=tedghanime@gmail.com --role=admin --clientId=unbound-merino
 *   node scripts/setup-user.js --uid=USER_UID --role=admin --clientId=unbound-merino
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

function parseArgs() {
  const args = process.argv.slice(2);
  return args.reduce((acc, arg) => {
    if (!arg.startsWith("--")) return acc;
    const eqIndex = arg.indexOf("=");
    const key = eqIndex > -1 ? arg.slice(2, eqIndex) : arg.slice(2);
    const value = eqIndex > -1 ? arg.slice(eqIndex + 1) : true;
    acc[key] = value;
    return acc;
  }, {});
}

async function main() {
  const options = parseArgs();

  if (options.help || (!options.uid && !options.email) || !options.role || !options.clientId) {
    console.log("Usage: node scripts/setup-user.js [--uid=<UID>|--email=<EMAIL>] --role=<role> --clientId=<clientId> [--project=<projectId>]");
    console.log("\nOptions:");
    console.log("  --uid           User's Firebase Auth UID");
    console.log("  --email         User's email (script will lookup UID)");
    console.log("  --role          User role (admin, producer, editor, viewer)");
    console.log("  --clientId      Client/tenant ID (e.g., unbound-merino)");
    console.log("  --project       Firebase project ID (optional)");
    console.log("\nExample:");
    console.log("  node scripts/setup-user.js --email=ted@immediategroup.ca --role=admin --clientId=unbound-merino");
    process.exit(options.help ? 0 : 1);
  }

  const projectId = options.project || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error("❌ Missing project id. Pass --project or set FIREBASE_PROJECT_ID/GCLOUD_PROJECT.");
    process.exit(1);
  }

  console.log(`\n🚀 Setting up user profile for project: ${projectId}\n`);

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const auth = getAuth();
  const db = getFirestore();

  let uid = options.uid;
  let userRecord;

  try {
    // If email provided, look up the user
    if (options.email) {
      console.log(`🔍 Looking up user by email: ${options.email}`);
      userRecord = await auth.getUserByEmail(options.email);
      uid = userRecord.uid;
      console.log(`✅ Found user with UID: ${uid}`);
    } else {
      userRecord = await auth.getUser(uid);
      console.log(`✅ Found user: ${userRecord.email}`);
    }

    // Step 1: Set custom claims
    console.log(`\n📝 Setting custom claims...`);
    const claims = {
      role: options.role,
      clientId: options.clientId,
    };

    await auth.setCustomUserClaims(uid, claims);
    console.log(`✅ Custom claims set:`, claims);

    // Force refresh token
    await auth.revokeRefreshTokens(uid);
    console.log(`✅ Revoked refresh tokens (user must sign out/in to get new claims)`);

    // Step 2: Create user profile document
    console.log(`\n📄 Creating user profile document...`);
    const userDocPath = `clients/${options.clientId}/users/${uid}`;
    const userDocRef = db.doc(userDocPath);

    const userProfile = {
      email: userRecord.email || null,
      displayName: userRecord.displayName || null,
      role: options.role,
      projects: {},
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await userDocRef.set(userProfile, { merge: true });
    console.log(`✅ User profile created at: ${userDocPath}`);
    console.log(`   Email: ${userProfile.email}`);
    console.log(`   Role: ${userProfile.role}`);
    console.log(`   DisplayName: ${userProfile.displayName || "(none)"}`);

    // Verify the document was created
    const doc = await userDocRef.get();
    if (doc.exists) {
      console.log(`\n✅ Verified: User profile document exists in Firestore`);
    }

    console.log(`\n🎉 SUCCESS! User profile setup complete.`);
    console.log(`\n⚠️  IMPORTANT: The user must sign out and sign back in to receive the new custom claims.`);
    console.log(`   After signing back in, the app should work without permission errors.`);

  } catch (err) {
    console.error("\n❌ Failed to set up user profile:", err.message);
    if (err.code) {
      console.error(`   Error code: ${err.code}`);
    }
    process.exit(1);
  }
}

main();
