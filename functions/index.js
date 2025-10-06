// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// FALLBACK: Only used if Firestore admin collection is not accessible
// Set SUPER_ADMIN_EMAIL in environment variables for production
const FALLBACK_SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || "ted@immediategroup.ca";

/**
 * Check if the given email is authorized to manage user claims.
 * Checks in order:
 * 1. Firestore /systemAdmins collection
 * 2. Fallback to environment variable or hardcoded super admin
 *
 * @param {string} email - The email to check
 * @returns {Promise<boolean>} - Whether the email is authorized
 */
async function isAuthorizedAdmin(email) {
  if (!email) return false;

  try {
    // Check Firestore for system admins
    const adminDoc = await admin.firestore()
      .collection("systemAdmins")
      .doc(email)
      .get();

    if (adminDoc.exists && adminDoc.data().enabled === true) {
      return true;
    }
  } catch (error) {
    console.error("Error checking systemAdmins collection:", error);
    // Continue to fallback
  }

  // Fallback to super admin
  return email === FALLBACK_SUPER_ADMIN;
}

/**
 * Callable: setUserClaims (Cloud Functions v1)
 * data: { targetEmail: string, role: "admin"|"editor"|"viewer"|"warehouse"|"producer"|"crew", clientId: string }
 */
exports.setUserClaims = functions
  .region("northamerica-northeast1")
  .https.onCall(async (data, context) => {
    // Check authentication
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const callerEmail = context.auth.token.email;
    const isAuthorized = await isAuthorizedAdmin(callerEmail);

    if (!isAuthorized) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized.");
    }

    const targetEmail = data.targetEmail;
    const role = data.role;
    const clientId = data.clientId;

    const VALID_ROLES = {
      admin: true,
      editor: true,
      viewer: true,
      warehouse: true,
      producer: true,
      crew: true,
    };

    if (!targetEmail || !VALID_ROLES[role] || !clientId) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Invalid input. Provide targetEmail, role, clientId."
      );
    }

    const user = await admin.auth().getUserByEmail(targetEmail);
    const newClaims = user.customClaims || {};
    newClaims.role = role;
    newClaims.clientId = clientId;

    await admin.auth().setCustomUserClaims(user.uid, newClaims);
    await admin.auth().revokeRefreshTokens(user.uid);

    return { ok: true, uid: user.uid, claims: newClaims };
  });

/**
 * HTTP Endpoint: resolvePullShareToken (Cloud Functions v1)
 * Securely resolves a public share token to pull data without exposing database structure.
 * This prevents client-side collection scanning and rate-limits token resolution.
 * Uses Cloud Functions v1 to work with Firebase Hosting rewrites without IAM policy issues.
 *
 * POST body: { data: { shareToken: string } }
 * returns: { pull: object, clientId: string, projectId: string } | { error: string }
 */
exports.resolvePullShareToken = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      // Parse request body (supports both httpsCallable and fetch formats)
      const body = req.body || {};
      const data = body.data || body;
      const shareToken = data.shareToken;

      if (!shareToken || typeof shareToken !== "string" || shareToken.length < 10) {
        res.status(400).json({ error: "Invalid share token" });
        return;
      }

      const db = admin.firestore();

      // Use collection group query to find the pull across all clients/projects
      // This requires a composite index on the pulls collection
      const pullsQuery = db.collectionGroup("pulls")
        .where("shareToken", "==", shareToken)
        .where("shareEnabled", "==", true)
        .limit(1);

      const snapshot = await pullsQuery.get();

      if (snapshot.empty) {
        res.status(404).json({ error: "Pull not found or sharing is disabled" });
        return;
      }

      const pullDoc = snapshot.docs[0];
      const pullData = pullDoc.data();

      // Extract client ID and project ID from the document path
      // Path format: clients/{clientId}/projects/{projectId}/pulls/{pullId}
      const pathParts = pullDoc.ref.path.split("/");
      const clientId = pathParts[1];
      const projectId = pathParts[3];

      // Validate share token hasn't expired (if expireAt field exists)
      if (pullData.shareExpireAt) {
        const expireDate = pullData.shareExpireAt.toDate();
        if (expireDate < new Date()) {
          res.status(410).json({ error: "Share link has expired" });
          return;
        }
      }

      // Return pull data without sensitive information
      res.status(200).json({
        pull: {
          id: pullDoc.id,
          name: pullData.name,
          items: pullData.items || [],
          createdAt: pullData.createdAt,
          notes: pullData.notes,
          // Exclude sensitive fields
          // Don't return: userId, projectId path, etc.
        },
        clientId,
        projectId
      });
    } catch (error) {
      console.error("[resolvePullShareToken] Error:", error);
      res.status(500).json({ error: "Failed to resolve share token" });
    }
  });
