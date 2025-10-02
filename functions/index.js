// functions/index.js
const { onCall } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
setGlobalOptions({ region: "northamerica-northeast1" }); // use your region

// Only these emails can assign claims.
const ALLOWED_ADMINS = new Set([
  "ted@immediategroup.ca" // <-- add more emails if needed
]);

/**
 * Callable: setUserClaims
 * data: { targetEmail: string, role: "admin"|"editor"|"viewer"|"warehouse"|"producer"|"crew", clientId: string }
 */
exports.setUserClaims = onCall(async (request) => {
  // Avoid optional chaining to keep ESLint happy with default config
  var auth = request.auth;
  var callerEmail = auth && auth.token ? auth.token.email : null;
  if (!callerEmail || !ALLOWED_ADMINS.has(callerEmail)) {
    throw new Error("Not authorized.");
  }

  var data = request.data || {};
  var targetEmail = data.targetEmail;
  var role = data.role;
  var clientId = data.clientId;

  var VALID = {
    admin: true,
    editor: true,
    viewer: true,
    warehouse: true,
    producer: true,
    crew: true,
  };
  if (!targetEmail || !VALID[role] || !clientId) {
    throw new Error("Invalid input. Provide targetEmail, role, clientId.");
  }

  var user = await admin.auth().getUserByEmail(targetEmail);
  var newClaims = user.customClaims || {};
  newClaims.role = role;
  newClaims.clientId = clientId;

  await admin.auth().setCustomUserClaims(user.uid, newClaims);
  await admin.auth().revokeRefreshTokens(user.uid);

  return { ok: true, uid: user.uid, claims: newClaims };
});
