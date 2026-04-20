// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

const { sendInvitationEmail, sendRequestNotificationEmail } = require("./email");
const {
  handlePublishCallSheet,
  handleRecordCallSheetShareView,
  handleConfirmCallSheetShare,
  handleResendCallSheetShare,
  handleRevokeCallSheetShare,
} = require("./src/callSheetShares.js");

// FALLBACK: Only used if Firestore admin collection is not accessible
// Set SUPER_ADMIN_EMAIL in environment variables for production
const FALLBACK_SUPER_ADMIN = process.env.SUPER_ADMIN_EMAIL || "ted@immediategroup.ca";

// --- Utility functions ---

async function isAuthorizedAdmin(email) {
  if (!email) return false;

  try {
    const adminDoc = await admin.firestore()
      .collection("systemAdmins")
      .doc(email)
      .get();

    if (adminDoc.exists && adminDoc.data().enabled === true) {
      return true;
    }
  } catch (error) {
    console.error("Error checking systemAdmins collection:", error);
  }

  return email === FALLBACK_SUPER_ADMIN;
}

function handleCors(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return true;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }
  return false;
}

async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.split("Bearer ")[1];
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}

async function processInvitation(invitationDoc, caller) {
  const invitation = invitationDoc.data();
  const uid = caller.uid;

  const pathParts = invitationDoc.ref.path.split("/");
  const clientId = pathParts[1];

  if (!clientId) {
    throw new Error("Could not determine client from invitation.");
  }

  let baseClaims = {};
  try {
    const userRecord = await admin.auth().getUser(uid);
    baseClaims = userRecord.customClaims || {};
  } catch {
    // New user, no existing claims
  }
  const updatedClaims = { ...baseClaims, role: invitation.role, clientId };

  await admin.auth().setCustomUserClaims(uid, updatedClaims);

  const db = admin.firestore();
  await db.collection("clients").doc(clientId).collection("users").doc(uid).set({
    email: caller.email,
    displayName: caller.name || null,
    role: invitation.role,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { mergeFields: ["email", "displayName", "role", "updatedAt"] });

  await invitationDoc.ref.update({
    status: "claimed",
    claimedAt: admin.firestore.FieldValue.serverTimestamp(),
    claimedByUid: uid,
  });

  // Auto-assign to projects if specified on the invitation
  const assignToProjects = Array.isArray(invitation.assignToProjects)
    ? invitation.assignToProjects.filter((id) => typeof id === "string" && id.trim().length > 0)
    : [];

  if (assignToProjects.length > 0) {
    // Clamp org-level "admin" to "producer" for project membership — "admin" is
    // not a valid project-scoped role (hasProjectRole checks producer/crew/warehouse/viewer).
    const projectRole = invitation.role === "admin" ? "producer" : invitation.role;
    const memberWrites = assignToProjects.map((projectId) =>
      db.collection("clients").doc(clientId).collection("projects")
        .doc(projectId).collection("members").doc(uid)
        .set({
          role: projectRole,
          addedAt: admin.firestore.FieldValue.serverTimestamp(),
          addedBy: invitation.invitedBy || "system",
        }, { merge: true }),
    );
    await Promise.all(memberWrites);
    console.log(`[processInvitation] Auto-assigned ${uid} to ${assignToProjects.length} projects`);
  }

  // Note: Do NOT call revokeRefreshTokens here. The caller is claiming their
  // OWN invitation — revoking would invalidate their session before the client
  // can call getIdToken(true) to pick up the new custom claims.

  return { ok: true, role: invitation.role, clientId };
}

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
    // eslint-disable-next-line global-require
    const { randomUUID } = require("crypto");
    if (typeof randomUUID === "function") return `public-${randomUUID()}`;
  } catch {
    // Ignore and fall back
  }
  return `public-${Math.random().toString(36).slice(2)}`;
};

// --- Error code to HTTP status mapping (for onRequest fallback) ---

const CODE_TO_STATUS = {
  "unauthenticated": 401,
  "permission-denied": 403,
  "invalid-argument": 400,
  "not-found": 404,
  "failed-precondition": 400,
};

function sendHandlerError(res, error, logTag) {
  const code = error.code || "internal";
  const status = CODE_TO_STATUS[code] || 500;
  const message = status < 500 ? error.message : "Internal error";
  console.error(`[${logTag}] Error:`, error);
  res.status(status).json({ error: message, code });
}

// --- Extracted handler functions (shared by onRequest fallback and processQueue trigger) ---

async function handleSetUserClaims(data, caller) {
  const targetEmail = data.targetEmail;
  const role = data.role;
  const clientId = data.clientId;

  const callerEmail = caller.email;
  const isAuthorized = await isAuthorizedAdmin(callerEmail);

  if (!isAuthorized) {
    const callerRole = caller.role;
    const callerClientId = caller.clientId;
    if (callerRole === "admin" && callerClientId === clientId) {
      // App-level admin within the same client — allowed
    } else {
      throw Object.assign(new Error("Not authorized."), { code: "permission-denied" });
    }
  }

  const VALID_ROLES = {
    admin: true,
    editor: true,
    viewer: true,
    warehouse: true,
    producer: true,
    crew: true,
  };

  if (!targetEmail || !VALID_ROLES[role] || !clientId) {
    throw Object.assign(new Error("Invalid input. Provide targetEmail, role, clientId."), { code: "invalid-argument" });
  }

  let user;
  try {
    user = await admin.auth().getUserByEmail(targetEmail);
  } catch (lookupErr) {
    if (lookupErr.code === "auth/user-not-found") {
      const normalizedEmail = targetEmail.trim().toLowerCase();
      const invitationRef = admin.firestore()
        .collection("clients")
        .doc(clientId)
        .collection("pendingInvitations")
        .doc(normalizedEmail);

      const assignToProjects = Array.isArray(data.assignToProjects)
        ? data.assignToProjects.filter((id) => typeof id === "string" && id.trim().length > 0)
        : [];

      await invitationRef.set({
        email: normalizedEmail,
        role,
        displayName: null,
        invitedBy: caller.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending",
        claimedAt: null,
        claimedByUid: null,
        ...(assignToProjects.length > 0 ? { assignToProjects } : {}),
      }, { merge: true });

      // Send invitation email (non-blocking — failure does not affect the invitation)
      const inviterName = caller.name || caller.email || "A team member";
      const inviterEmail = caller.email || "";
      await sendInvitationEmail({
        to: normalizedEmail,
        role,
        inviterName,
        inviterEmail,
      });

      return { ok: true, pending: true, email: targetEmail.trim() };
    }
    throw lookupErr;
  }

  const newClaims = { ...(user.customClaims || {}), role, clientId };

  await admin.auth().setCustomUserClaims(user.uid, newClaims);

  // Only revoke refresh tokens when admin is changing ANOTHER user's claims.
  // Revoking on self would invalidate the caller's session before the client
  // can call getIdToken(true) to pick up the new custom claims.
  if (user.uid !== caller.uid) {
    await admin.auth().revokeRefreshTokens(user.uid);
  }

  return { ok: true, uid: user.uid, claims: newClaims };
}

async function handleClaimInvitation(data, caller) {
  const callerEmail = caller.email;
  if (!callerEmail) {
    return { ok: false, reason: "no-email" };
  }

  const normalizedEmail = callerEmail.trim().toLowerCase();
  const db = admin.firestore();

  const invitationsQuery = db.collectionGroup("pendingInvitations")
    .where("status", "==", "pending")
    .where("email", "==", normalizedEmail)
    .limit(1);

  const snapshot = await invitationsQuery.get();

  if (snapshot.empty) {
    return { ok: false, reason: "no-invitation" };
  }

  return processInvitation(snapshot.docs[0], caller);
}

async function handleCreateShotShareLink(data, caller) {
  const rawRole = caller.role;
  const role = typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";
  const rawClientId = caller.clientId ?? caller.orgId;
  const clientId = typeof rawClientId === "string" ? rawClientId.trim() : "";

  if (!clientId) {
    throw Object.assign(new Error("Missing client scope."), { code: "failed-precondition" });
  }

  const canCreate = role === "admin" || role === "producer" || role === "wardrobe";
  if (!canCreate) {
    throw Object.assign(new Error("Not authorized to share shots."), { code: "permission-denied" });
  }

  const projectId = data.projectId;
  if (!projectId || typeof projectId !== "string" || projectId.trim().length === 0) {
    throw Object.assign(new Error("Invalid projectId."), { code: "invalid-argument" });
  }

  const scopeRaw = data.scope;
  const scope = scopeRaw === "selected" ? "selected" : "project";

  const titleRaw = data.title;
  const title = typeof titleRaw === "string" ? titleRaw.trim() : "";
  if (!title) {
    throw Object.assign(new Error("Title is required."), { code: "invalid-argument" });
  }

  const shotIdsRaw = data.shotIds;
  let shotIds = null;
  if (scope === "selected") {
    if (!Array.isArray(shotIdsRaw)) {
      throw Object.assign(new Error("shotIds must be a list when scope is selected."), { code: "invalid-argument" });
    }
    const ids = shotIdsRaw
      .filter((id) => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      throw Object.assign(new Error("Select at least one shot to share."), { code: "invalid-argument" });
    }
    if (ids.length > 500) {
      throw Object.assign(new Error("Too many shots selected (max 500)."), { code: "invalid-argument" });
    }
    shotIds = ids;
  }

  const db = admin.firestore();

  const normalizedProjectId = projectId.trim();
  const projectRef = db.collection("clients").doc(clientId).collection("projects").doc(normalizedProjectId);
  const projectSnap = await projectRef.get();
  if (!projectSnap.exists) {
    throw Object.assign(new Error("Project not found."), { code: "not-found" });
  }

  if (role !== "admin") {
    const membersRef = projectRef.collection("members");
    const [memberSnap, anyMembersSnap] = await Promise.all([
      membersRef.doc(caller.uid).get(),
      membersRef.limit(1).get(),
    ]);
    const membersConfigured = !anyMembersSnap.empty;
    if (membersConfigured && !memberSnap.exists) {
      throw Object.assign(new Error("You don't have access to this project."), { code: "permission-denied" });
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
    createdBy: caller.uid,
  });

  return { shareToken: shareRef.id };
}

async function handlePublicUpdatePull(data) {
  const shareToken = data.shareToken;
  const email = data.email;
  const actions = Array.isArray(data.actions) ? data.actions : [];

  if (!shareToken || typeof shareToken !== "string" || shareToken.length < 8) {
    throw Object.assign(new Error("Invalid share token."), { code: "invalid-argument" });
  }

  if (!isValidEmail(email)) {
    throw Object.assign(new Error("A valid email is required."), { code: "invalid-argument" });
  }

  if (actions.length === 0) {
    throw Object.assign(new Error("No actions provided."), { code: "invalid-argument" });
  }

  const db = admin.firestore();

  const pullsQuery = db.collectionGroup("pulls")
    .where("shareToken", "==", shareToken)
    .where("shareEnabled", "==", true)
    .limit(1);

  const snapshot = await pullsQuery.get();
  if (snapshot.empty) {
    throw Object.assign(new Error("Pull not found or sharing is disabled."), { code: "not-found" });
  }

  const pullDoc = snapshot.docs[0];

  const result = await db.runTransaction(async (tx) => {
    const freshSnap = await tx.get(pullDoc.ref);
    if (!freshSnap.exists) {
      throw Object.assign(new Error("Pull not found."), { code: "not-found" });
    }

    const pullData = freshSnap.data() || {};

    if (!pullData.shareEnabled || pullData.shareToken !== shareToken) {
      throw Object.assign(new Error("Sharing is disabled for this pull."), { code: "permission-denied" });
    }

    if (!pullData.shareAllowResponses) {
      throw Object.assign(new Error("Responses are disabled for this pull."), { code: "permission-denied" });
    }

    if (pullData.shareExpireAt) {
      const expireDate = pullData.shareExpireAt.toDate ? pullData.shareExpireAt.toDate() : new Date(pullData.shareExpireAt);
      if (expireDate < new Date()) {
        throw Object.assign(new Error("Share link has expired."), { code: "failed-precondition" });
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
          const derivedStatus = nextFulfilled >= quantity ? "fulfilled" : nextFulfilled > 0 ? "partial" : "pending";
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
}

async function handleSendRequestNotification(data, caller) {
  if (!caller) {
    throw Object.assign(new Error("Authentication required."), { code: "unauthenticated" });
  }

  const requestId = data.requestId;
  const clientId = data.clientId;

  if (!requestId || typeof requestId !== "string" || requestId.trim().length === 0) {
    throw Object.assign(new Error("requestId is required."), { code: "invalid-argument" });
  }
  if (!clientId || typeof clientId !== "string" || clientId.trim().length === 0) {
    throw Object.assign(new Error("clientId is required."), { code: "invalid-argument" });
  }

  const callerClientId = caller.clientId || caller.orgId;
  if (callerClientId !== clientId) {
    throw Object.assign(new Error("Client mismatch."), { code: "permission-denied" });
  }

  const db = admin.firestore();

  const requestRef = db.collection("clients").doc(clientId).collection("shotRequests").doc(requestId);
  const requestSnap = await requestRef.get();
  if (!requestSnap.exists) {
    throw Object.assign(new Error("Request not found."), { code: "not-found" });
  }

  const requestData = requestSnap.data();
  const notifyUserIds = Array.isArray(requestData.notifyUserIds) && requestData.notifyUserIds.length > 0
    ? requestData.notifyUserIds
    : null;

  let recipientUids;
  if (notifyUserIds) {
    recipientUids = notifyUserIds.filter((id) => typeof id === "string" && id.trim().length > 0);
  } else {
    const usersSnap = await db.collection("clients").doc(clientId).collection("users").get();
    recipientUids = usersSnap.docs
      .filter((d) => d.data().role === "admin" || d.data().role === "producer")
      .map((d) => d.id);
  }

  if (recipientUids.length === 0) {
    return { notified: 0 };
  }

  const userDocs = await Promise.all(
    recipientUids.map((uid) =>
      db.collection("clients").doc(clientId).collection("users").doc(uid).get()
    )
  );

  const toAddresses = userDocs
    .filter((snap) => snap.exists && typeof snap.data().email === "string" && snap.data().email.trim().length > 0)
    .map((snap) => snap.data().email.trim());

  if (toAddresses.length === 0) {
    return { notified: 0 };
  }

  const appUrl = process.env.APP_URL || "https://um-shotbuilder.web.app";
  const requestUrl = `${appUrl}/requests`;

  await sendRequestNotificationEmail({
    to: toAddresses,
    requestTitle: String(requestData.title || "Untitled"),
    submitterName: String(requestData.submittedByName || requestData.submittedBy || "A team member"),
    priority: String(requestData.priority || "normal"),
    requestUrl,
  });

  return { notified: toAddresses.length };
}

async function handleResendInvitationEmail(data, caller) {
  if (!caller) {
    throw Object.assign(new Error("Authentication required."), { code: "unauthenticated" });
  }

  const callerEmail = caller.email;
  const isAuthorized = await isAuthorizedAdmin(callerEmail);

  if (!isAuthorized) {
    const callerRole = caller.role;
    if (callerRole !== "admin") {
      throw Object.assign(new Error("Not authorized."), { code: "permission-denied" });
    }
  }

  const targetEmail = data.targetEmail;
  const role = data.role;

  if (!targetEmail || typeof targetEmail !== "string") {
    throw Object.assign(new Error("targetEmail is required."), { code: "invalid-argument" });
  }
  if (!role || typeof role !== "string") {
    throw Object.assign(new Error("role is required."), { code: "invalid-argument" });
  }

  const inviterName = caller.name || caller.email || "A team member";
  const inviterEmail = caller.email || "";

  await sendInvitationEmail({
    to: targetEmail.trim().toLowerCase(),
    role,
    inviterName,
    inviterEmail,
  });

  return { ok: true };
}

async function handleDeactivateUser(data, caller) {
  if (!caller) {
    throw Object.assign(new Error("Authentication required."), { code: "unauthenticated" });
  }

  const callerEmail = caller.email;
  const clientId = data.clientId;
  const targetUid = data.targetUid;

  if (!clientId || typeof clientId !== "string") {
    throw Object.assign(new Error("clientId is required."), { code: "invalid-argument" });
  }
  if (!targetUid || typeof targetUid !== "string") {
    throw Object.assign(new Error("targetUid is required."), { code: "invalid-argument" });
  }

  const isAuthorized = await isAuthorizedAdmin(callerEmail);
  if (!isAuthorized) {
    const callerRole = caller.role;
    const callerClientId = caller.clientId;
    if (callerRole !== "admin" || callerClientId !== clientId) {
      throw Object.assign(new Error("Not authorized."), { code: "permission-denied" });
    }
  }

  // Prevent self-deactivation
  if (targetUid === caller.uid) {
    throw Object.assign(new Error("Cannot deactivate your own account."), { code: "failed-precondition" });
  }

  // Verify target user belongs to this client (prevent cross-client deactivation)
  const targetUser = await admin.auth().getUser(targetUid);
  if (targetUser.customClaims?.clientId !== clientId) {
    throw Object.assign(new Error("User does not belong to this client."), { code: "permission-denied" });
  }

  // Clear custom claims
  await admin.auth().setCustomUserClaims(targetUid, {});

  const db = admin.firestore();

  // Update user doc status
  await db.collection("clients").doc(clientId).collection("users").doc(targetUid).update({
    status: "deactivated",
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Remove from all project memberships in this client
  const projectsSnap = await db.collection("clients").doc(clientId).collection("projects").get();
  const memberRefs = projectsSnap.docs.map((d) =>
    d.ref.collection("members").doc(targetUid)
  );
  const memberSnaps = await Promise.all(memberRefs.map((ref) => ref.get()));
  const refsToDelete = memberSnaps.filter((s) => s.exists).map((s) => s.ref);

  // Firestore batch limit is 500 — chunk deletes
  const CHUNK = 499;
  for (let i = 0; i < refsToDelete.length; i += CHUNK) {
    const batch = db.batch();
    refsToDelete.slice(i, i + CHUNK).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }

  // Revoke refresh tokens to force immediate lockout.
  // Safe: caller is admin, target is a different user (self-deactivation blocked above).
  await admin.auth().revokeRefreshTokens(targetUid);
  console.log(`[deactivateUser] Deactivated ${targetUid} in client ${clientId}, removed from ${refsToDelete.length} projects, tokens revoked`);

  return { ok: true };
}

async function handleReactivateUser(data, caller) {
  if (!caller) {
    throw Object.assign(new Error("Authentication required."), { code: "unauthenticated" });
  }

  const callerEmail = caller.email;
  const clientId = data.clientId;
  const targetUid = data.targetUid;
  const role = data.role;

  if (!clientId || typeof clientId !== "string") {
    throw Object.assign(new Error("clientId is required."), { code: "invalid-argument" });
  }
  if (!targetUid || typeof targetUid !== "string") {
    throw Object.assign(new Error("targetUid is required."), { code: "invalid-argument" });
  }
  if (!role || typeof role !== "string") {
    throw Object.assign(new Error("role is required."), { code: "invalid-argument" });
  }

  const isAuthorized = await isAuthorizedAdmin(callerEmail);
  if (!isAuthorized) {
    const callerRole = caller.role;
    const callerClientId = caller.clientId;
    if (callerRole !== "admin" || callerClientId !== clientId) {
      throw Object.assign(new Error("Not authorized."), { code: "permission-denied" });
    }
  }

  // Set custom claims with provided role and clientId
  await admin.auth().setCustomUserClaims(targetUid, { role, clientId });

  const db = admin.firestore();

  // Update user doc status
  await db.collection("clients").doc(clientId).collection("users").doc(targetUid).update({
    status: "active",
    role,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Revoke refresh tokens to force re-auth with new claims
  await admin.auth().revokeRefreshTokens(targetUid);

  console.log(`[reactivateUser] Reactivated ${targetUid} in client ${clientId} with role ${role}`);

  return { ok: true };
}

// --- onRequest exports (dormant fallback — active when IAM is resolved) ---

exports.setUserClaims = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const caller = await verifyAuth(req);
      if (!caller) {
        res.status(401).json({ error: "Authentication required.", code: "unauthenticated" });
        return;
      }
      const result = await handleSetUserClaims(req.body || {}, caller);
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "setUserClaims");
    }
  });

exports.claimInvitation = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const caller = await verifyAuth(req);
      if (!caller) {
        res.status(401).json({ error: "Authentication required.", code: "unauthenticated" });
        return;
      }
      const result = await handleClaimInvitation({}, caller);
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "claimInvitation");
    }
  });

exports.createShotShareLink = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const caller = await verifyAuth(req);
      if (!caller) {
        res.status(401).json({ error: "Authentication required.", code: "unauthenticated" });
        return;
      }
      const result = await handleCreateShotShareLink(req.body || {}, caller);
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "createShotShareLink");
    }
  });

exports.publicUpdatePull = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const result = await handlePublicUpdatePull(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "publicUpdatePull");
    }
  });

// --- Phase 3 publishing: anonymous view ping + confirm ---

exports.recordCallSheetShareView = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const result = await handleRecordCallSheetShareView(req.body || {});
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "recordCallSheetShareView");
    }
  });

exports.confirmCallSheetShare = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      // Forward the caller's IP so the handler can hash it for abuse triage
      // (plan §4.4 step 4). `req.ip` is populated by Cloud Functions from
      // x-forwarded-for; fall back to connection remoteAddress locally.
      const ip =
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.socket?.remoteAddress ||
        null;
      const result = await handleConfirmCallSheetShare(req.body || {}, { ip });
      res.status(200).json(result);
    } catch (error) {
      sendHandlerError(res, error, "confirmCallSheetShare");
    }
  });

// --- Firestore queue trigger (bypasses HTTP/CORS/IAM) ---

exports.processQueue = functions
  .region("northamerica-northeast1")
  .firestore.document("_functionQueue/{docId}")
  .onCreate(async (snap) => {
    const { action, data, createdBy } = snap.data();
    try {
      let caller = null;
      if (createdBy && createdBy !== "anonymous") {
        const userRecord = await admin.auth().getUser(createdBy);
        caller = {
          uid: userRecord.uid,
          email: userRecord.email,
          name: userRecord.displayName,
          ...(userRecord.customClaims || {}),
        };
      }

      let result;
      switch (action) {
        case "setUserClaims":
          result = await handleSetUserClaims(data, caller);
          break;
        case "claimInvitation":
          result = await handleClaimInvitation(data, caller);
          break;
        case "createShotShareLink":
          result = await handleCreateShotShareLink(data, caller);
          break;
        case "publicUpdatePull":
          result = await handlePublicUpdatePull(data);
          break;
        case "resendInvitationEmail":
          result = await handleResendInvitationEmail(data, caller);
          break;
        case "deactivateUser":
          result = await handleDeactivateUser(data, caller);
          break;
        case "reactivateUser":
          result = await handleReactivateUser(data, caller);
          break;
        case "sendRequestNotification":
          result = await handleSendRequestNotification(data, caller);
          break;
        case "publishCallSheet":
          result = await handlePublishCallSheet(data, caller);
          break;
        case "resendCallSheetShare":
          result = await handleResendCallSheetShare(data, caller);
          break;
        case "revokeCallSheetShare":
          result = await handleRevokeCallSheetShare(data, caller);
          break;
        default:
          throw Object.assign(new Error(`Unknown action: ${action}`), { code: "invalid-argument" });
      }

      await snap.ref.update({
        status: "complete",
        result,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error(`[processQueue] Error processing ${action}:`, error);
      await snap.ref.update({
        status: "error",
        error: error.message,
        code: error.code || "internal",
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

// --- HTTP endpoints (not queued — these are called directly via hosting rewrites) ---

exports.resolvePullShareToken = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const body = req.body || {};
      const data = body.data || body;
      const shareToken = data.shareToken;

      if (!shareToken || typeof shareToken !== "string" || shareToken.length < 10) {
        res.status(400).json({ error: "Invalid share token" });
        return;
      }

      const db = admin.firestore();

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

      const pathParts = pullDoc.ref.path.split("/");
      const clientId = pathParts[1];
      const projectId = pathParts[3];

      if (pullData.shareExpireAt) {
        const expireDate = pullData.shareExpireAt.toDate();
        if (expireDate < new Date()) {
          res.status(410).json({ error: "Share link has expired" });
          return;
        }
      }

      res.status(200).json({
        pull: {
          id: pullDoc.id,
          name: pullData.name,
          items: pullData.items || [],
          createdAt: pullData.createdAt,
          notes: pullData.notes,
        },
        clientId,
        projectId
      });
    } catch (error) {
      console.error("[resolvePullShareToken] Error:", error);
      res.status(500).json({ error: "Failed to resolve share token" });
    }
  });

exports.resolveShotShareToken = functions
  .region("northamerica-northeast1")
  .https.onRequest(async (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    try {
      const body = req.body || {};
      const data = body.data || body;
      const shareToken = data.shareToken;

      if (!shareToken || typeof shareToken !== "string" || shareToken.length < 10) {
        res.status(400).json({ error: "Invalid share token." });
        return;
      }

      const db = admin.firestore();
      const shareRef = db.collection("shotShares").doc(shareToken);
      const shareSnap = await shareRef.get();

      if (!shareSnap.exists) {
        res.status(404).json({ error: "Share link not found." });
        return;
      }

      const share = shareSnap.data() || {};
      if (share.enabled !== true) {
        res.status(403).json({ error: "Sharing is disabled." });
        return;
      }

      if (share.expiresAt) {
        try {
          const expiresAt = share.expiresAt.toDate();
          if (expiresAt.getTime() < Date.now()) {
            res.status(410).json({ error: "Share link has expired." });
            return;
          }
        } catch (err) {
          // Ignore malformed expiresAt — treat as non-expired
        }
      }

      const clientId = share.clientId;
      const projectId = share.projectId;
      if (!clientId || typeof clientId !== "string" || !projectId || typeof projectId !== "string") {
        res.status(500).json({ error: "Share link is misconfigured." });
        return;
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

      const shotsRaw = shotDocs
        .map((d) => ({ id: d.id, ...d.data }))
        .filter((s) => s && s.projectId === projectId && s.deleted !== true);

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

      res.status(200).json({
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
      });
    } catch (error) {
      console.error("[resolveShotShareToken] Error:", error);
      res.status(500).json({ error: "Failed to resolve share token" });
    }
  });

// --- Scheduled functions ---

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

        if (snapshot.docs.length < BATCH_SIZE) {
          hasMoreVersions = false;
        }
      }

      console.log(`[cleanupVersionsAndLocks] Deleted ${totalVersionsDeleted} expired versions`);

      const staleThreshold = new Date(now.getTime() - 60 * 1000);

      const presenceQuery = db.collectionGroup("presence")
        .where("lastActivity", "<=", staleThreshold)
        .limit(BATCH_SIZE);

      const presenceSnapshot = await presenceQuery.get();

      for (const presenceDoc of presenceSnapshot.docs) {
        const data = presenceDoc.data();
        const locks = data.locks || {};

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

      // Clean up expired _functionQueue documents (expiresAt < now)
      let totalQueueDeleted = 0;
      const queueQuery = db.collection("_functionQueue")
        .where("expiresAt", "<=", now)
        .limit(BATCH_SIZE);

      let hasMoreQueue = true;
      while (hasMoreQueue) {
        const queueSnap = await queueQuery.get();
        if (queueSnap.empty) {
          hasMoreQueue = false;
          break;
        }
        const queueBatch = db.batch();
        queueSnap.docs.forEach((d) => queueBatch.delete(d.ref));
        await queueBatch.commit();
        totalQueueDeleted += queueSnap.docs.length;
        if (queueSnap.docs.length < BATCH_SIZE) hasMoreQueue = false;
      }

      console.log(`[cleanupVersionsAndLocks] Deleted ${totalQueueDeleted} expired queue docs`);
      console.log(`[cleanupVersionsAndLocks] Cleanup complete. Versions: ${totalVersionsDeleted}, Locks: ${totalLocksCleared}, Queue: ${totalQueueDeleted}`);

      return null;
    } catch (error) {
      console.error("[cleanupVersionsAndLocks] Error during cleanup:", error);
      throw error;
    }
  });
