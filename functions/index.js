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

/**
 * Callable: resolveShotShareToken (Cloud Functions v1)
 * Resolves a share token to a read-only shot list payload.
 *
 * data: { shareToken: string }
 * returns: { share, project, shots }
 *
 * Notes:
 * - This is intentionally callable so the SPA can resolve without Firestore public reads.
 * - Firestore rules deny unauthenticated reads of /shotShares/**.
 */
exports.resolveShotShareToken = functions
  .region("northamerica-northeast1")
  .https.onCall(async (data) => {
    const shareToken = data?.shareToken;
    if (!shareToken || typeof shareToken !== "string" || shareToken.length < 10) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid share token.");
    }

    const db = admin.firestore();
    const shareRef = db.collection("shotShares").doc(shareToken);
    const shareSnap = await shareRef.get();

    if (!shareSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Share link not found.");
    }

    const share = shareSnap.data() || {};
    if (share.enabled !== true) {
      throw new functions.https.HttpsError("permission-denied", "Sharing is disabled.");
    }

    if (share.expiresAt) {
      try {
        const expiresAt = share.expiresAt.toDate();
        if (expiresAt.getTime() < Date.now()) {
          throw new functions.https.HttpsError("failed-precondition", "Share link has expired.");
        }
      } catch (err) {
        if (err instanceof functions.https.HttpsError) throw err;
      }
    }

    const clientId = share.clientId;
    const projectId = share.projectId;
    if (!clientId || typeof clientId !== "string" || !projectId || typeof projectId !== "string") {
      throw new functions.https.HttpsError("failed-precondition", "Share link is misconfigured.");
    }

    const projectSnap = await db.collection("clients").doc(clientId).collection("projects").doc(projectId).get();
    const projectData = projectSnap.exists ? (projectSnap.data() || {}) : {};
    const projectName = typeof projectData.name === "string" ? projectData.name : "Project";

    const normaliseString = (value) => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const formatProduct = (p) => {
      if (!p || typeof p !== "object") return null;
      const familyName = normaliseString(p.familyName) || normaliseString(p.skuName) || null;
      if (!familyName) return null;

      const parts = [];
      const colour = normaliseString(p.colourName);
      if (colour) parts.push(colour);

      const scope = p.sizeScope;
      if (scope === "all") parts.push("All sizes");
      else if (scope === "pending" || !scope) parts.push("Size TBD");
      else if (scope === "single") {
        const size = normaliseString(p.size);
        if (size) parts.push(size);
      }

      const qty = Number.isFinite(p.quantity) ? p.quantity : null;
      if (qty && qty > 1) parts.push(`x${qty}`);

      return parts.length > 0 ? `${familyName} (${parts.join(" • ")})` : familyName;
    };

    const primaryLookProducts = (shot) => {
      const looks = Array.isArray(shot.looks) ? shot.looks : [];
      if (looks.length === 0) return null;
      let primary = looks[0];
      looks.forEach((l) => {
        const currentOrder = typeof primary.order === "number" ? primary.order : 0;
        const nextOrder = typeof l.order === "number" ? l.order : 0;
        if (nextOrder < currentOrder) primary = l;
      });
      const products = primary && Array.isArray(primary.products) ? primary.products : [];
      return products;
    };

    const shareShotIds = Array.isArray(share.shotIds)
      ? share.shotIds.filter((id) => typeof id === "string" && id.trim().length > 0)
      : null;

    let shotDocs = [];
    if (shareShotIds && shareShotIds.length > 0) {
      const refs = shareShotIds.map((sid) => db.collection("clients").doc(clientId).collection("shots").doc(sid));
      const snaps = await db.getAll(...refs);
      shotDocs = snaps.filter((s) => s.exists).map((s) => ({ id: s.id, data: s.data() || {} }));
    } else {
      // Match the vNext list query index: projectId + deleted + date
      const snaps = await db
        .collection("clients")
        .doc(clientId)
        .collection("shots")
        .where("projectId", "==", projectId)
        .where("deleted", "==", false)
        .orderBy("date", "asc")
        .get();
      shotDocs = snaps.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
    }

    // Filter to the intended project and non-deleted (defense-in-depth)
    const shotsRaw = shotDocs
      .map((d) => ({ id: d.id, ...d.data }))
      .filter((s) => s && s.projectId === projectId && s.deleted !== true);

    // Resolve talent + locations for name rendering (batch reads).
    const collectTalentIds = () => {
      const set = new Set();
      shotsRaw.forEach((s) => {
        const list = Array.isArray(s.talentIds) ? s.talentIds : Array.isArray(s.talent) ? s.talent : [];
        list.forEach((id) => {
          if (typeof id === "string" && id.trim().length > 0) set.add(id);
        });
      });
      return Array.from(set);
    };

    const collectLocationIds = () => {
      const set = new Set();
      shotsRaw.forEach((s) => {
        const id = s.locationId;
        if (typeof id === "string" && id.trim().length > 0) set.add(id);
      });
      return Array.from(set);
    };

    const talentIds = collectTalentIds();
    const locationIds = collectLocationIds();

    const talentNameById = new Map();
    if (talentIds.length > 0) {
      const refs = talentIds.map((tid) => db.collection("clients").doc(clientId).collection("talent").doc(tid));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s) => {
        const name = s.exists ? normaliseString((s.data() || {}).name) : null;
        if (name) talentNameById.set(s.id, name);
      });
    }

    const locationNameById = new Map();
    if (locationIds.length > 0) {
      const refs = locationIds.map((lid) => db.collection("clients").doc(clientId).collection("locations").doc(lid));
      const snaps = await db.getAll(...refs);
      snaps.forEach((s) => {
        const name = s.exists ? normaliseString((s.data() || {}).name) : null;
        if (name) locationNameById.set(s.id, name);
      });
    }

    const toIso = (ts) => {
      if (!ts) return null;
      try {
        return ts.toDate().toISOString();
      } catch {
        return null;
      }
    };

    const shots = shotsRaw.map((s) => {
      const title = normaliseString(s.title) || normaliseString(s.name) || "Untitled Shot";
      const shotNumber = normaliseString(s.shotNumber);
      const status = normaliseString(s.status) || "todo";

      const locationId = normaliseString(s.locationId);
      const locationName =
        normaliseString(s.locationName) || (locationId ? locationNameById.get(locationId) || null : null);

      const talentList = Array.isArray(s.talentIds) ? s.talentIds : Array.isArray(s.talent) ? s.talent : [];
      const talentNames = talentList
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter(Boolean)
        .map((id) => talentNameById.get(id) || null)
        .filter(Boolean);

      const productsRaw = primaryLookProducts(s) || (Array.isArray(s.products) ? s.products : []);
      const productLines = productsRaw.map(formatProduct).filter(Boolean);

      return {
        id: s.id,
        title,
        shotNumber,
        status,
        date: toIso(s.date),
        locationName: locationName || null,
        talentNames,
        productLines,
        description: normaliseString(s.description) || null,
        notesAddendum: normaliseString(s.notesAddendum) || null,
      };
    });

    return {
      share: {
        id: shareToken,
        title: normaliseString(share.title) || null,
        expiresAt: toIso(share.expiresAt),
        scope: shareShotIds && shareShotIds.length > 0 ? "selected" : "project",
      },
      project: {
        id: projectId,
        name: projectName,
      },
      shots,
    };
  });

/**
 * Callable: createShotShareLink (Cloud Functions v1)
 * Creates a share token doc in /shotShares for a project or selection.
 *
 * data: { projectId: string, scope: "project"|"selected", shotIds?: string[]|null, title: string }
 * returns: { shareToken: string }
 */
exports.createShotShareLink = functions
  .region("northamerica-northeast1")
  .https.onCall(async (data, context) => {
    if (!context.auth || !context.auth.uid) {
      throw new functions.https.HttpsError("unauthenticated", "Authentication required.");
    }

    const rawRole = context.auth.token?.role;
    const role = typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";
    const rawClientId = context.auth.token?.clientId ?? context.auth.token?.orgId;
    const clientId = typeof rawClientId === "string" ? rawClientId.trim() : "";

    if (!clientId) {
      throw new functions.https.HttpsError("failed-precondition", "Missing client scope.");
    }

    const canCreate = role === "admin" || role === "producer" || role === "wardrobe";
    if (!canCreate) {
      throw new functions.https.HttpsError("permission-denied", "Not authorized to share shots.");
    }

    const projectId = data?.projectId;
    if (!projectId || typeof projectId !== "string" || projectId.trim().length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid projectId.");
    }

    const scopeRaw = data?.scope;
    const scope = scopeRaw === "selected" ? "selected" : "project";

    const titleRaw = data?.title;
    const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
    if (!title) {
      throw new functions.https.HttpsError("invalid-argument", "Title is required.");
    }

    const shotIdsRaw = data?.shotIds;
    let shotIds = null;
    if (scope === "selected") {
      if (!Array.isArray(shotIdsRaw)) {
        throw new functions.https.HttpsError("invalid-argument", "shotIds must be a list when scope is selected.");
      }
      const ids = shotIdsRaw
        .filter((id) => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Select at least one shot to share.");
      }
      // Keep payload bounded: long lists degrade link usefulness and response size.
      if (ids.length > 500) {
        throw new functions.https.HttpsError("invalid-argument", "Too many shots selected (max 500).");
      }
      shotIds = ids;
    }

    const db = admin.firestore();

    const normalizedProjectId = projectId.trim();
    const projectRef = db.collection("clients").doc(clientId).collection("projects").doc(normalizedProjectId);
    const projectSnap = await projectRef.get();
    if (!projectSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Project not found.");
    }

    // Compatibility contract:
    // - If members are configured, enforce membership.
    // - If no members exist (legacy projects), fall back to role-based access.
    if (role !== "admin") {
      const membersRef = projectRef.collection("members");
      const [memberSnap, anyMembersSnap] = await Promise.all([
        membersRef.doc(context.auth.uid).get(),
        membersRef.limit(1).get(),
      ]);
      const membersConfigured = !anyMembersSnap.empty;
      if (membersConfigured && !memberSnap.exists) {
        throw new functions.https.HttpsError("permission-denied", "You don't have access to this project.");
      }
    }

    const shareRef = db.collection("shotShares").doc();
    await shareRef.set({
      clientId,
      projectId: normalizedProjectId,
      shotIds,
      enabled: true,
      title,
      expiresAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid,
    });

    return { shareToken: shareRef.id };
  });

const isValidEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

const coerceInt = (value, { min = null, max = null } = {}) => {
  const number = typeof value === "number" ? value : Number(String(value ?? "").trim());
  if (!Number.isFinite(number)) return null;
  const rounded = Math.round(number);
  if (min !== null && rounded < min) return min;
  if (max !== null && rounded > max) return max;
  return rounded;
};

const calculateItemFulfillment = (item) => {
  if (!item || !Array.isArray(item.sizes) || item.sizes.length === 0) return "pending";

  let totalRequested = 0;
  let totalFulfilled = 0;
  let hasSubstitution = false;

  item.sizes.forEach((size) => {
    totalRequested += size.quantity || 0;
    totalFulfilled += size.fulfilled || 0;
    if (size.status === "substituted") hasSubstitution = true;
  });

  if (hasSubstitution) return "substituted";
  if (totalFulfilled <= 0) return "pending";
  if (totalFulfilled >= totalRequested) return "fulfilled";
  return "partial";
};

const generatePublicItemId = () => {
  try {
    // Node 18+ supports crypto.randomUUID
    // eslint-disable-next-line global-require
    const { randomUUID } = require("crypto");
    if (typeof randomUUID === "function") return `public-${randomUUID()}`;
  } catch {
    // Ignore and fall back
  }
  return `public-${Math.random().toString(36).slice(2)}`;
};

/**
 * Callable: publicUpdatePull (Cloud Functions v1)
 * Allows unauthenticated updates to a shared pull when:
 * - shareEnabled=true
 * - shareToken matches
 * - shareAllowResponses=true
 * Warehouse crew supplies an email for attribution (not verified).
 *
 * data: {
 *   shareToken: string,
 *   email: string,
 *   actions: Array<
 *     | { type: "updateFulfillment", itemId: string, sizes: Array<{ size: string, fulfilled: number, status?: string }> }
 *     | { type: "addItem", item: { familyName: string, styleNumber?: string|null, gender?: string|null, notes?: string|null, sizes: Array<{ size: string, quantity: number }> } }
 *   >
 * }
 */
exports.publicUpdatePull = functions
  .region("northamerica-northeast1")
  .https.onCall(async (data) => {
    const payload = data || {};
    const shareToken = payload.shareToken;
    const email = payload.email;
    const actions = Array.isArray(payload.actions) ? payload.actions : [];

    if (!shareToken || typeof shareToken !== "string" || shareToken.length < 10) {
      throw new functions.https.HttpsError("invalid-argument", "Invalid share token.");
    }

    if (!isValidEmail(email)) {
      throw new functions.https.HttpsError("invalid-argument", "A valid email is required.");
    }

    if (actions.length === 0) {
      throw new functions.https.HttpsError("invalid-argument", "No actions provided.");
    }

    const db = admin.firestore();

    const pullsQuery = db.collectionGroup("pulls")
      .where("shareToken", "==", shareToken)
      .where("shareEnabled", "==", true)
      .limit(1);

    const snapshot = await pullsQuery.get();
    if (snapshot.empty) {
      throw new functions.https.HttpsError("not-found", "Pull not found or sharing is disabled.");
    }

    const pullDoc = snapshot.docs[0];

    const result = await db.runTransaction(async (tx) => {
      const freshSnap = await tx.get(pullDoc.ref);
      if (!freshSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Pull not found.");
      }

      const pullData = freshSnap.data() || {};

      if (!pullData.shareEnabled || pullData.shareToken !== shareToken) {
        throw new functions.https.HttpsError("permission-denied", "Sharing is disabled for this pull.");
      }

      if (!pullData.shareAllowResponses) {
        throw new functions.https.HttpsError("permission-denied", "Responses are disabled for this pull.");
      }

      if (pullData.shareExpireAt) {
        const expireDate = pullData.shareExpireAt.toDate ? pullData.shareExpireAt.toDate() : new Date(pullData.shareExpireAt);
        if (expireDate < new Date()) {
          throw new functions.https.HttpsError("failed-precondition", "Share link has expired.");
        }
      }

      const existingItems = Array.isArray(pullData.items) ? pullData.items.slice() : [];
      const updatedItems = existingItems.map((item) => ({ ...item, sizes: Array.isArray(item.sizes) ? item.sizes.map((s) => ({ ...s })) : [] }));

      const activityEntries = [];

      actions.forEach((action) => {
        if (!action || typeof action !== "object") return;

        if (action.type === "updateFulfillment") {
          const itemId = action.itemId;
          const sizes = Array.isArray(action.sizes) ? action.sizes : [];
          if (!itemId || typeof itemId !== "string" || sizes.length === 0) return;

          const idx = updatedItems.findIndex((it) => it.id === itemId);
          if (idx < 0) return;

          const item = updatedItems[idx];
          const nextSizes = Array.isArray(item.sizes) ? item.sizes.map((s) => ({ ...s })) : [];

          const updatesApplied = [];
          sizes.forEach((sizeUpdate) => {
            const sizeLabel = sizeUpdate?.size;
            if (!sizeLabel || typeof sizeLabel !== "string") return;

            const sizeIdx = nextSizes.findIndex((s) => s.size === sizeLabel);
            if (sizeIdx < 0) return;

            const current = nextSizes[sizeIdx];
            const quantity = typeof current.quantity === "number" ? current.quantity : 0;
            const nextFulfilled = coerceInt(sizeUpdate.fulfilled, { min: 0, max: quantity });
            if (nextFulfilled === null) return;

            const allowedStatuses = new Set(["pending", "fulfilled", "substituted"]);
            const requestedStatus = typeof sizeUpdate.status === "string" ? sizeUpdate.status : null;
            const derivedStatus = nextFulfilled >= quantity ? "fulfilled" : nextFulfilled > 0 ? "pending" : "pending";
            const nextStatus = requestedStatus && allowedStatuses.has(requestedStatus)
              ? requestedStatus
              : derivedStatus;

            nextSizes[sizeIdx] = { ...current, fulfilled: nextFulfilled, status: nextStatus };
            updatesApplied.push({ size: sizeLabel, fulfilled: nextFulfilled, status: nextStatus });
          });

          const nextItem = { ...item, sizes: nextSizes };
          nextItem.fulfillmentStatus = calculateItemFulfillment(nextItem);
          updatedItems[idx] = nextItem;

          if (updatesApplied.length) {
            activityEntries.push({
              type: "fulfillment",
              itemId,
              sizes: updatesApplied,
            });
          }
        }

        if (action.type === "addItem") {
          const itemInput = action.item || {};
          const familyName = typeof itemInput.familyName === "string" ? itemInput.familyName.trim() : "";
          const sizesInput = Array.isArray(itemInput.sizes) ? itemInput.sizes : [];
          if (!familyName || sizesInput.length === 0) return;

          const normalizedSizes = sizesInput
            .map((entry) => {
              const sizeLabel = typeof entry.size === "string" ? entry.size.trim() : "";
              if (!sizeLabel) return null;
              const quantity = coerceInt(entry.quantity, { min: 1, max: 999 });
              if (quantity === null) return null;
              return { size: sizeLabel, quantity, fulfilled: 0, status: "pending" };
            })
            .filter(Boolean);

          if (!normalizedSizes.length) return;

          const newItem = {
            id: generatePublicItemId(),
            familyId: generatePublicItemId(),
            familyName,
            styleNumber: typeof itemInput.styleNumber === "string" && itemInput.styleNumber.trim()
              ? itemInput.styleNumber.trim()
              : null,
            colourId: null,
            colourName: null,
            colourImagePath: null,
            sizes: normalizedSizes,
            notes: typeof itemInput.notes === "string" ? itemInput.notes.trim() : "",
            gender: typeof itemInput.gender === "string" && itemInput.gender.trim() ? itemInput.gender.trim() : null,
            category: null,
            genderOverride: null,
            categoryOverride: null,
            fulfillmentStatus: "pending",
            shotIds: [],
            publicCreatedByEmail: String(email).trim(),
          };

          newItem.fulfillmentStatus = calculateItemFulfillment(newItem);
          updatedItems.push(newItem);

          activityEntries.push({
            type: "addItem",
            itemId: newItem.id,
            familyName: newItem.familyName,
            sizes: newItem.sizes.map((s) => ({ size: s.size, quantity: s.quantity })),
          });
        }
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      tx.update(pullDoc.ref, {
        items: updatedItems,
        updatedAt: now,
        lastPublicUpdateAt: now,
        lastPublicUpdateEmail: String(email).trim(),
      });

      activityEntries.forEach((entry) => {
        const ref = pullDoc.ref.collection("publicActivity").doc();
        tx.set(ref, {
          createdAt: now,
          email: String(email).trim(),
          entry,
        });
      });

      return {
        id: pullDoc.id,
        title: pullData.title || pullData.name || "",
        items: updatedItems,
      };
    });

    return { ok: true, pull: result };
  });

/**
 * Scheduled: cleanupVersionsAndLocks (Cloud Functions v1)
 * Runs every hour to clean up:
 * 1. Expired version snapshots (15-day retention)
 * 2. Stale field locks (60 seconds without heartbeat)
 *
 * This helps manage storage costs and ensure locks don't get stuck.
 */
exports.cleanupVersionsAndLocks = functions
  .region("northamerica-northeast1")
  .pubsub.schedule("every 60 minutes")
  .onRun(async (context) => {
    const db = admin.firestore();
    const now = new Date();
    const BATCH_SIZE = 500;

    let totalVersionsDeleted = 0;
    let totalLocksCleared = 0;

    console.log("[cleanupVersionsAndLocks] Starting cleanup...");

    try {
      // 1. Clean up expired versions using collection group query
      // Versions have expiresAt field set to 15 days from creation
      const expiredVersionsQuery = db.collectionGroup("versions")
        .where("expiresAt", "<=", now)
        .limit(BATCH_SIZE);

      let hasMoreVersions = true;
      while (hasMoreVersions) {
        const snapshot = await expiredVersionsQuery.get();

        if (snapshot.empty) {
          hasMoreVersions = false;
          break;
        }

        const batch = db.batch();
        snapshot.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        totalVersionsDeleted += snapshot.docs.length;

        // If we got less than batch size, we're done
        if (snapshot.docs.length < BATCH_SIZE) {
          hasMoreVersions = false;
        }
      }

      console.log(`[cleanupVersionsAndLocks] Deleted ${totalVersionsDeleted} expired versions`);

      // 2. Clean up stale field locks
      // Locks expire if heartbeat is older than 60 seconds
      const staleThreshold = new Date(now.getTime() - 60 * 1000);

      // Query all presence documents that might have stale locks
      // We need to check each presence document and clean up stale locks
      const presenceQuery = db.collectionGroup("presence")
        .where("lastActivity", "<=", staleThreshold)
        .limit(BATCH_SIZE);

      const presenceSnapshot = await presenceQuery.get();

      for (const presenceDoc of presenceSnapshot.docs) {
        const data = presenceDoc.data();
        const locks = data.locks || {};

        // Find stale locks
        const staleLockPaths = [];
        for (const [fieldPath, lock] of Object.entries(locks)) {
          if (!lock.heartbeat) {
            staleLockPaths.push(fieldPath);
            continue;
          }

          const heartbeatTime = lock.heartbeat.toDate ? lock.heartbeat.toDate() : new Date(lock.heartbeat);
          if (heartbeatTime <= staleThreshold) {
            staleLockPaths.push(fieldPath);
          }
        }

        // Remove stale locks
        if (staleLockPaths.length > 0) {
          const updates = {};
          staleLockPaths.forEach((path) => {
            updates[`locks.${path}`] = admin.firestore.FieldValue.delete();
          });

          await presenceDoc.ref.update(updates);
          totalLocksCleared += staleLockPaths.length;
        }
      }

      console.log(`[cleanupVersionsAndLocks] Cleared ${totalLocksCleared} stale locks`);
      console.log(`[cleanupVersionsAndLocks] Cleanup complete. Versions: ${totalVersionsDeleted}, Locks: ${totalLocksCleared}`);

      return null;
    } catch (error) {
      console.error("[cleanupVersionsAndLocks] Error during cleanup:", error);
      throw error;
    }
  });
