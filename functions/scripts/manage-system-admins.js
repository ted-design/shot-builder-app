#!/usr/bin/env node

/**
 * System Admin Management Script
 *
 * This script manages the systemAdmins collection in Firestore.
 * System admins can assign roles and claims to other users via Cloud Functions.
 *
 * Usage:
 *   node manage-system-admins.js add <email>       - Add a system admin
 *   node manage-system-admins.js remove <email>    - Remove a system admin
 *   node manage-system-admins.js list              - List all system admins
 *   node manage-system-admins.js enable <email>    - Enable a system admin
 *   node manage-system-admins.js disable <email>   - Disable a system admin
 */

const admin = require("firebase-admin");
const serviceAccount = require("../service-account.json");

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const command = process.argv[2];
const email = process.argv[3];

async function addSystemAdmin(email) {
  if (!email || !email.includes("@")) {
    console.error("Invalid email address");
    process.exit(1);
  }

  try {
    await db.collection("systemAdmins").doc(email).set({
      email: email,
      enabled: true,
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
      addedBy: "script"
    });

    console.log(`✅ Successfully added system admin: ${email}`);
  } catch (error) {
    console.error("Error adding system admin:", error);
    process.exit(1);
  }
}

async function removeSystemAdmin(email) {
  if (!email) {
    console.error("Email is required");
    process.exit(1);
  }

  try {
    await db.collection("systemAdmins").doc(email).delete();
    console.log(`✅ Successfully removed system admin: ${email}`);
  } catch (error) {
    console.error("Error removing system admin:", error);
    process.exit(1);
  }
}

async function listSystemAdmins() {
  try {
    const snapshot = await db.collection("systemAdmins").get();

    if (snapshot.empty) {
      console.log("No system admins found");
      return;
    }

    console.log("\n=== System Admins ===\n");
    snapshot.forEach(doc => {
      const data = doc.data();
      const status = data.enabled ? "✅ ENABLED" : "❌ DISABLED";
      console.log(`${status}  ${doc.id}`);
      console.log(`   Added: ${data.addedAt ? data.addedAt.toDate() : "Unknown"}`);
      console.log(`   Added by: ${data.addedBy || "Unknown"}`);
      console.log("");
    });
  } catch (error) {
    console.error("Error listing system admins:", error);
    process.exit(1);
  }
}

async function enableSystemAdmin(email) {
  if (!email) {
    console.error("Email is required");
    process.exit(1);
  }

  try {
    await db.collection("systemAdmins").doc(email).update({
      enabled: true
    });
    console.log(`✅ Successfully enabled system admin: ${email}`);
  } catch (error) {
    console.error("Error enabling system admin:", error);
    process.exit(1);
  }
}

async function disableSystemAdmin(email) {
  if (!email) {
    console.error("Email is required");
    process.exit(1);
  }

  try {
    await db.collection("systemAdmins").doc(email).update({
      enabled: false
    });
    console.log(`✅ Successfully disabled system admin: ${email}`);
  } catch (error) {
    console.error("Error disabling system admin:", error);
    process.exit(1);
  }
}

async function main() {
  switch (command) {
    case "add":
      await addSystemAdmin(email);
      break;
    case "remove":
      await removeSystemAdmin(email);
      break;
    case "list":
      await listSystemAdmins();
      break;
    case "enable":
      await enableSystemAdmin(email);
      break;
    case "disable":
      await disableSystemAdmin(email);
      break;
    default:
      console.log("Usage:");
      console.log("  node manage-system-admins.js add <email>");
      console.log("  node manage-system-admins.js remove <email>");
      console.log("  node manage-system-admins.js list");
      console.log("  node manage-system-admins.js enable <email>");
      console.log("  node manage-system-admins.js disable <email>");
      process.exit(1);
  }

  process.exit(0);
}

main();
