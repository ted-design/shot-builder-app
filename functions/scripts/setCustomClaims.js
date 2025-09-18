#!/usr/bin/env node

/**
 * Set custom Firebase Auth claims for a user. Requires Application Default Credentials
 * (export GOOGLE_APPLICATION_CREDENTIALS or run inside `firebase functions:shell`).
 *
 * Usage:
 *   node scripts/setCustomClaims.js --uid=UID --role=producer --clientId=unbound-merino
 *   node scripts/setCustomClaims.js --uid=UID --role=admin --orgId=my-agency
 */

const { initializeApp, applicationDefault } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

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
  if (options.help || !options.uid || !options.role || (!options.clientId && !options.orgId)) {
    console.log("Usage: node scripts/setCustomClaims.js --uid=<UID> --role=<role> --clientId=<clientId> [--orgId=<orgId>] [--project=<projectId>]");
    console.log("At least one of clientId or orgId must be provided. Claims overwrite previous values.");
    process.exit(options.help ? 0 : 1);
  }

  const projectId = options.project || process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
  if (!projectId) {
    console.error("Missing project id. Pass --project or set FIREBASE_PROJECT_ID/GCLOUD_PROJECT.");
    process.exit(1);
  }

  initializeApp({
    credential: applicationDefault(),
    projectId,
  });

  const auth = getAuth();
  const claims = {
    role: options.role,
  };
  if (options.clientId) {
    claims.clientId = options.clientId;
  }
  if (options.orgId) {
    claims.orgId = options.orgId;
  }

  try {
    await auth.setCustomUserClaims(options.uid, claims);
    // Force refresh token fetch on next auth interaction.
    await auth.revokeRefreshTokens(options.uid);
    const user = await auth.getUser(options.uid);
    console.log(`Updated custom claims for ${options.uid} in project ${projectId}:`, user.customClaims);
    console.log("Ask the user to sign out/in or call getIdToken(true) to pull the new claims.");
  } catch (err) {
    console.error("Failed to set custom claims", err);
    process.exit(1);
  }
}

main();
