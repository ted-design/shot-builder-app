// functions/index.js
const { onCall } = require("firebase-functions/v1/https");
const { region } = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// Configure functions to run in specific region
const functionsRegion = region("northamerica-northeast1");

// Admin emails that can assign claims and manage organizations
const ALLOWED_ADMINS = new Set([
  "ted@immediategroup.ca" // Add more emails as needed
]);

/**
 * Set user custom claims for role-based access control
 * Callable function: setUserClaims
 * data: { 
 *   targetEmail: string, 
 *   role: "admin"|"producer"|"editor"|"viewer"|"catalog"|"warehouse",
 *   orgId: string 
 * }
 */
exports.setUserClaims = functionsRegion.https.onCall(async (data, context) => {
  var auth = context.auth;
  var callerEmail = auth && auth.token ? auth.token.email : null;
  
  if (!callerEmail || !ALLOWED_ADMINS.has(callerEmail)) {
    throw new Error("Not authorized to set user claims.");
  }

  var { targetEmail, role, orgId } = data;

  var VALID_ROLES = { 
    admin: true, 
    producer: true, 
    editor: true, 
    viewer: true, 
    catalog: true, 
    warehouse: true 
  };
  
  if (!targetEmail || !VALID_ROLES[role] || !orgId) {
    throw new Error("Invalid input. Provide targetEmail, role, and orgId.");
  }

  try {
    var user = await admin.auth().getUserByEmail(targetEmail);
    var newClaims = user.customClaims || {};
    newClaims.role = role;
    newClaims.orgId = orgId;

    await admin.auth().setCustomUserClaims(user.uid, newClaims);
    await admin.auth().revokeRefreshTokens(user.uid);

    // Also create a member document in Firestore
    await admin.firestore()
      .doc(`orgs/${orgId}/members/${user.uid}`)
      .set({
        email: targetEmail,
        role: role,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        addedAt: admin.firestore.FieldValue.serverTimestamp(),
        addedBy: callerEmail
      }, { merge: true });

    return { ok: true, uid: user.uid, claims: newClaims };
  } catch (error) {
    console.error("Error setting user claims:", error);
    throw new Error("Failed to set user claims: " + error.message);
  }
});

/**
 * Initialize organization for new users
 * This function automatically assigns default role and org when a user first signs in
 */
exports.initializeUser = functionsRegion.https.onCall(async (data, context) => {
  var auth = context.auth;
  if (!auth) {
    throw new Error("Not authenticated.");
  }

  var uid = auth.uid;
  var email = auth.token.email;
  
  // Check if user already has custom claims
  var user = await admin.auth().getUser(uid);
  if (user.customClaims && user.customClaims.orgId) {
    return { ok: true, message: "User already initialized" };
  }

  // For demo purposes, assign default organization and viewer role
  // In production, this would be more sophisticated based on invitation system
  var defaultOrgId = "unbound-merino";
  var defaultRole = "viewer";
  
  try {
    var newClaims = {
      role: defaultRole,
      orgId: defaultOrgId
    };

    await admin.auth().setCustomUserClaims(uid, newClaims);
    await admin.auth().revokeRefreshTokens(uid);

    // Create member document
    await admin.firestore()
      .doc(`orgs/${defaultOrgId}/members/${uid}`)
      .set({
        email: email,
        role: defaultRole,
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      }, { merge: true });

    return { ok: true, uid: uid, claims: newClaims };
  } catch (error) {
    console.error("Error initializing user:", error);
    throw new Error("Failed to initialize user: " + error.message);
  }
});

/**
 * Create organization and set caller as admin
 */
exports.createOrganization = onCall(async (request) => {
  var auth = request.auth;
  if (!auth) {
    throw new Error("Not authenticated.");
  }

  var data = request.data || {};
  var orgName = data.name;
  var orgId = data.orgId; // Optional custom org ID
  
  if (!orgName) {
    throw new Error("Organization name is required.");
  }

  var uid = auth.uid;
  var email = auth.token.email;
  
  try {
    // Generate org ID if not provided
    if (!orgId) {
      orgId = orgName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
    }

    // Create organization document
    await admin.firestore()
      .doc(`orgs/${orgId}`)
      .set({
        name: orgName,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        settings: {
          defaultRole: 'viewer',
          allowSelfSignup: false
        }
      });

    // Set user as admin of the new organization
    await admin.auth().setCustomUserClaims(uid, {
      role: 'admin',
      orgId: orgId
    });
    
    await admin.auth().revokeRefreshTokens(uid);

    // Create admin member document
    var user = await admin.auth().getUser(uid);
    await admin.firestore()
      .doc(`orgs/${orgId}/members/${uid}`)
      .set({
        email: email,
        role: 'admin',
        displayName: user.displayName || null,
        photoURL: user.photoURL || null,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active'
      });

    return { ok: true, orgId: orgId, role: 'admin' };
  } catch (error) {
    console.error("Error creating organization:", error);
    throw new Error("Failed to create organization: " + error.message);
  }
});
