/**
 * Phase 3 publishing — Cloud Functions handler bodies.
 *
 * Five handlers wired via `functions/index.js`:
 *   - handlePublishCallSheet        — queue (op: publishCallSheet)
 *   - handleRecordCallSheetShareView — https onRequest, anonymous
 *   - handleConfirmCallSheetShare   — https onRequest, anonymous
 *   - handleResendCallSheetShare    — queue (op: resendCallSheetShare)
 *   - handleRevokeCallSheetShare    — queue (op: revokeCallSheetShare)
 *
 * Writes go through `admin.firestore()` (service-account auth), bypassing
 * the rules that deny anonymous + authed direct writes to `callSheetShares`.
 *
 * Error conventions match the existing handlers in functions/index.js:
 * throw `Object.assign(new Error(msg), { code: "invalid-argument" | ... })`.
 */

"use strict";

const admin = require("firebase-admin");
const crypto = require("node:crypto");
const { buildCallSheetShareSnapshot } = require("./callSheetShareSnapshot.js");
const {
  sendCallSheetShareEmail,
  sendCallSheetResendEmail,
  sendCallSheetConfirmationReceipt,
} = require("./callSheetEmails/index.js");

const SHARES_COLLECTION = "callSheetShares";
const RECIPIENTS_SUBCOLLECTION = "recipients";
const VIEW_RATE_LIMIT_MS = 10_000; // plan §4.3 anti-spam window

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function err(message, code) {
  return Object.assign(new Error(message), { code });
}

function parseCompoundToken(token) {
  if (typeof token !== "string") return null;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot === token.length - 1) return null;
  if (token.indexOf(".", dot + 1) !== -1) return null;
  return {
    shareGroupId: token.slice(0, dot),
    recipientToken: token.slice(dot + 1),
  };
}

function normalizeRole(caller) {
  const rawRole = caller?.role;
  return typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";
}

function normalizeClientId(caller) {
  const raw = caller?.clientId ?? caller?.orgId;
  return typeof raw === "string" ? raw.trim() : "";
}

function assertPublisherAuth(caller) {
  if (!caller?.uid) {
    throw err("Authentication required.", "unauthenticated");
  }
  const role = normalizeRole(caller);
  const canPublish = role === "admin" || role === "producer";
  if (!canPublish) {
    throw err("Not authorized to publish call sheets.", "permission-denied");
  }
  const clientId = normalizeClientId(caller);
  if (!clientId) {
    throw err("Missing client scope.", "failed-precondition");
  }
  return { uid: caller.uid, role, clientId };
}

function validateString(value, field, { max = 500, required = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw err(`Missing ${field}.`, "invalid-argument");
    return null;
  }
  if (typeof value !== "string") {
    throw err(`${field} must be a string.`, "invalid-argument");
  }
  const trimmed = value.trim();
  if (!trimmed && required) throw err(`Missing ${field}.`, "invalid-argument");
  if (trimmed.length > max) throw err(`${field} is too long.`, "invalid-argument");
  return trimmed;
}

function validateEmail(email, field = "email") {
  const trimmed = validateString(email, field, { max: 256 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw err(`${field} is not a valid email address.`, "invalid-argument");
  }
  return trimmed;
}

function validatePublishRecipients(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw err("At least one recipient is required.", "invalid-argument");
  }
  if (input.length > 200) {
    throw err("Too many recipients (max 200 per publish).", "invalid-argument");
  }
  const kindSet = new Set(["talent", "crew", "client", "adhoc"]);
  return input.map((r, i) => {
    const ctx = `recipients[${i}]`;
    if (!r || typeof r !== "object") {
      throw err(`${ctx} must be an object.`, "invalid-argument");
    }
    const personKind = r.personKind;
    if (!kindSet.has(personKind)) {
      throw err(`${ctx}.personKind must be one of talent|crew|client|adhoc.`, "invalid-argument");
    }
    return {
      personId: typeof r.personId === "string" && r.personId.trim() ? r.personId.trim() : null,
      personKind,
      name: validateString(r.name, `${ctx}.name`, { max: 200 }),
      email: validateEmail(r.email, `${ctx}.email`),
      phone: typeof r.phone === "string" && r.phone.trim() ? r.phone.trim().slice(0, 50) : null,
      roleLabel:
        typeof r.roleLabel === "string" && r.roleLabel.trim()
          ? r.roleLabel.trim().slice(0, 200)
          : null,
      callTime:
        typeof r.callTime === "string" && r.callTime.trim()
          ? r.callTime.trim().slice(0, 50)
          : null,
      precallTime:
        typeof r.precallTime === "string" && r.precallTime.trim()
          ? r.precallTime.trim().slice(0, 50)
          : null,
    };
  });
}

function hashIp(ip) {
  const salt = process.env.CALLSHEET_IP_HASH_SALT || "dev-only-fallback-salt";
  const text = typeof ip === "string" ? ip : "";
  return crypto.createHash("sha256").update(`${salt}:${text}`).digest("hex");
}

function formatShootDate(shootDate) {
  // Accepts a Firestore Timestamp-ish shape OR a plain Date. Returns a
  // stable human-readable label. More sophisticated formatting (timezone-
  // aware) is the UI layer's job; this is an email-body fallback.
  if (!shootDate) return "";
  try {
    const date =
      typeof shootDate.toDate === "function" ? shootDate.toDate() : new Date(shootDate);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatConfirmationTime(timestamp) {
  if (!timestamp) return "";
  try {
    const date =
      typeof timestamp.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Read all upstream docs for a given schedule/callSheet, in parallel. The
 * snapshot builder operates on plain data so this is the only Firestore I/O
 * the publish handler does before the write phase.
 */
async function loadPublishContext({ db, clientId, projectId, scheduleId, callSheetConfigId }) {
  const scheduleRef = db
    .collection("clients").doc(clientId)
    .collection("projects").doc(projectId)
    .collection("schedules").doc(scheduleId);
  const callSheetConfigRef = scheduleRef.collection("callSheet").doc(callSheetConfigId);
  const projectRef = db.collection("clients").doc(clientId).collection("projects").doc(projectId);
  const clientRef = db.collection("clients").doc(clientId);

  const [
    scheduleSnap,
    configSnap,
    projectSnap,
    clientSnap,
  ] = await Promise.all([
    scheduleRef.get(),
    callSheetConfigRef.get(),
    projectRef.get(),
    clientRef.get(),
  ]);

  if (!scheduleSnap.exists) throw err("Schedule not found.", "not-found");
  if (!configSnap.exists) throw err("Call sheet config not found.", "not-found");
  if (!projectSnap.exists) throw err("Project not found.", "not-found");

  const [
    dayDetailsSnap,
    tracksSnap,
    entriesSnap,
    talentCallsSnap,
    crewCallsSnap,
    clientCallsSnap,
    locationsSnap,
    talentRosterSnap,
    crewRosterSnap,
  ] = await Promise.all([
    scheduleRef.collection("dayDetails").doc("current").get()
      .catch(() => ({ exists: false, data: () => null })),
    scheduleRef.collection("tracks").get(),
    scheduleRef.collection("entries").get(),
    scheduleRef.collection("talentCalls").get(),
    scheduleRef.collection("crewCalls").get(),
    scheduleRef.collection("clientCalls").get(),
    scheduleRef.collection("locations").get().catch(() => ({ docs: [] })),
    projectRef.collection("talent").get().catch(() => ({ docs: [] })),
    projectRef.collection("crew").get().catch(() => ({ docs: [] })),
  ]);

  return {
    schedule: scheduleSnap.data() || {},
    config: configSnap.data() || {},
    project: projectSnap.data() || {},
    client: clientSnap.exists ? clientSnap.data() || {} : {},
    dayDetails: dayDetailsSnap?.exists ? dayDetailsSnap.data() : null,
    tracks: tracksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    entries: entriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    talentCalls: talentCallsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    crewCalls: crewCallsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    clientCalls: clientCallsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    locations: locationsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    talentRoster: talentRosterSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    crewRoster: crewRosterSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
  };
}

// ---------------------------------------------------------------------------
// handlePublishCallSheet
// ---------------------------------------------------------------------------

async function handlePublishCallSheet(data, caller) {
  const { uid, clientId } = assertPublisherAuth(caller);
  const projectId = validateString(data?.projectId, "projectId", { max: 128 });
  const scheduleId = validateString(data?.scheduleId, "scheduleId", { max: 128 });
  const callSheetConfigId = validateString(
    data?.callSheetConfigId,
    "callSheetConfigId",
    { max: 128 },
  );
  const emailSubject = validateString(data?.emailSubject, "emailSubject", { max: 500 });
  const emailMessageRaw = data?.emailMessage;
  const emailMessage =
    emailMessageRaw === null || emailMessageRaw === undefined || emailMessageRaw === ""
      ? null
      : validateString(emailMessageRaw, "emailMessage", { max: 5000 });
  const requireConfirm = Boolean(data?.requireConfirm);
  const publishAttemptId = validateString(
    data?.publishAttemptId,
    "publishAttemptId",
    { max: 128 },
  );
  const recipientInputs = validatePublishRecipients(data?.recipients);

  const db = admin.firestore();

  // Idempotency (plan §4.5). If a share already exists for this attemptId,
  // return the existing id without re-creating or re-sending.
  const existing = await db.collection(SHARES_COLLECTION)
    .where("clientId", "==", clientId)
    .where("publishAttemptId", "==", publishAttemptId)
    .limit(1)
    .get();
  if (!existing.empty) {
    const doc = existing.docs[0];
    return {
      shareGroupId: doc.id,
      recipientCount: doc.data().recipientCount || 0,
      failedSends: 0,
      deduped: true,
    };
  }

  // Project-membership check (mirrors handleCreateShotShareLink).
  const projectRef = db.collection("clients").doc(clientId)
    .collection("projects").doc(projectId);
  if (normalizeRole(caller) !== "admin") {
    const membersRef = projectRef.collection("members");
    const [memberSnap, anyMembersSnap] = await Promise.all([
      membersRef.doc(uid).get(),
      membersRef.limit(1).get(),
    ]);
    const membersConfigured = !anyMembersSnap.empty;
    if (membersConfigured && !memberSnap.exists) {
      throw err("You don't have access to this project.", "permission-denied");
    }
  }

  // Read upstream state.
  const ctx = await loadPublishContext({
    db, clientId, projectId, scheduleId, callSheetConfigId,
  });

  // Build the immutable snapshot.
  const shootDate = ctx.schedule.shootDate || ctx.schedule.date || null;
  const snapshot = buildCallSheetShareSnapshot({
    title: ctx.schedule.title || ctx.config?.title || "Call Sheet",
    shootDate,
    config: ctx.config,
    dayDetails: ctx.dayDetails,
    schedule: { tracks: ctx.tracks, entries: ctx.entries },
    talentCalls: ctx.talentCalls,
    crewCalls: ctx.crewCalls,
    clientCalls: ctx.clientCalls,
    locations: ctx.locations,
    talentRoster: ctx.talentRoster,
    crewRoster: ctx.crewRoster,
    project: ctx.project,
    client: ctx.client,
  });

  // Compute expiry (Q2 = B: shoot date + 14d).
  let expiresAt = null;
  if (shootDate) {
    try {
      const dateObj =
        typeof shootDate.toDate === "function" ? shootDate.toDate() : new Date(shootDate);
      const expiry = new Date(dateObj.getTime() + 14 * 24 * 60 * 60 * 1000);
      expiresAt = admin.firestore.Timestamp.fromDate(expiry);
    } catch {
      expiresAt = null;
    }
  }

  // Write share + recipients in a single batched write.
  const shareRef = db.collection(SHARES_COLLECTION).doc();
  const shareGroupId = shareRef.id;

  const recipientWrites = recipientInputs.map((recipient) => {
    const recipientRef = shareRef.collection(RECIPIENTS_SUBCOLLECTION).doc();
    return {
      ref: recipientRef,
      token: recipientRef.id,
      data: {
        shareGroupId,
        personId: recipient.personId,
        personKind: recipient.personKind,
        name: recipient.name,
        roleLabel: recipient.roleLabel,
        email: recipient.email,
        phone: recipient.phone,
        callTime: recipient.callTime,
        precallTime: recipient.precallTime,
        channel: "email",
        emailSentAt: null,
        emailSendError: null,
        emailSendAttempts: 0,
        viewCount: 0,
        firstViewedAt: null,
        lastViewedAt: null,
        isConfirmed: false,
        confirmedAt: null,
        confirmIpHash: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedAt: null,
      },
    };
  });

  const batch = db.batch();
  batch.set(shareRef, {
    clientId,
    projectId,
    scheduleId,
    callSheetConfigId,
    publishAttemptId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: uid,
    enabled: true,
    expiresAt,
    shootDate: shootDate || null,
    snapshot,
    emailSubject,
    emailMessage,
    requireConfirm,
    recipientCount: recipientWrites.length,
    viewedCount: 0,
    confirmedCount: 0,
  });
  recipientWrites.forEach(({ ref, data: payload }) => batch.set(ref, payload));
  await batch.commit();

  // Resolve publisher info for FROM + reply_to.
  const publisher = await resolvePublisher(db, uid);

  // Fan out emails (fail-open per plan §7.5).
  const formattedShootDate = formatShootDate(shootDate);
  const primaryLocationLabel = snapshot.locations?.[0]?.label || null;
  const defaultCallTime = snapshot.dayDetails?.generalCallTime || null;
  const expiryLabel = expiresAt
    ? `Link expires ${formatShootDate(expiresAt)}`
    : null;

  const sendResults = await Promise.all(recipientWrites.map(async ({ ref, token, data: r }) => {
    const result = await sendCallSheetShareEmail({
      recipient: {
        name: r.name,
        email: r.email,
        callTime: r.callTime,
        roleLabel: r.roleLabel,
        token,
        shareGroupId,
      },
      share: {
        projectName: snapshot.projectName,
        formattedShootDate,
        primaryLocationLabel,
        defaultCallTime,
        projectLogoUrl: snapshot.brand?.logoUrl || null,
        emailSubject,
        emailMessage,
        requireConfirm,
        expiryLabel,
      },
      publisher,
    });
    const now = admin.firestore.FieldValue.serverTimestamp();
    const updates = result.ok
      ? { emailSentAt: now, emailSendError: null, emailSendAttempts: 1 }
      : { emailSendError: result.error || "unknown", emailSendAttempts: 1 };
    try {
      await ref.update(updates);
    } catch (updateError) {
      console.error(
        `[publishCallSheet] Failed to update recipient ${ref.id} status:`,
        updateError,
      );
    }
    return result;
  }));

  const failedSends = sendResults.filter((r) => !r.ok).length;
  console.log(
    `[publishCallSheet] share=${shareGroupId} recipients=${recipientWrites.length} failed=${failedSends}`,
  );

  return {
    shareGroupId,
    recipientCount: recipientWrites.length,
    failedSends,
    deduped: false,
  };
}

async function resolvePublisher(db, uid) {
  try {
    const userRecord = await admin.auth().getUser(uid);
    return {
      name: userRecord.displayName || userRecord.email || "Production Hub",
      email: userRecord.email || "noreply@unboundmerino.immediategroup.ca",
    };
  } catch (error) {
    console.warn(`[publishCallSheet] Could not resolve publisher ${uid}:`, error?.message);
    return {
      name: "Production Hub",
      email: "noreply@unboundmerino.immediategroup.ca",
    };
  }
}

// ---------------------------------------------------------------------------
// handleRecordCallSheetShareView
// ---------------------------------------------------------------------------

async function handleRecordCallSheetShareView(data) {
  const tokenRaw = data?.token;
  const parsed = parseCompoundToken(tokenRaw);
  if (!parsed) throw err("Invalid token.", "invalid-argument");

  const db = admin.firestore();
  const shareRef = db.collection(SHARES_COLLECTION).doc(parsed.shareGroupId);
  const recipientRef = shareRef
    .collection(RECIPIENTS_SUBCOLLECTION)
    .doc(parsed.recipientToken);

  const [shareSnap, recipientSnap] = await Promise.all([shareRef.get(), recipientRef.get()]);
  if (!shareSnap.exists || !recipientSnap.exists) {
    throw err("Share not found.", "not-found");
  }
  const shareData = shareSnap.data();
  const recipientData = recipientSnap.data();

  if (!shareData.enabled) throw err("Share has been revoked.", "failed-precondition");
  if (shareData.expiresAt && shareData.expiresAt.toMillis() < Date.now()) {
    throw err("Share has expired.", "failed-precondition");
  }
  if (recipientData.revokedAt) {
    throw err("Recipient access revoked.", "failed-precondition");
  }

  // Anti-spam rate limit (plan §4.3 step 5).
  const lastViewedMs =
    recipientData.lastViewedAt?.toMillis?.() ||
    (recipientData.lastViewedAt instanceof Date
      ? recipientData.lastViewedAt.getTime()
      : 0);
  if (lastViewedMs && Date.now() - lastViewedMs < VIEW_RATE_LIMIT_MS) {
    return { ok: true, throttled: true };
  }

  const now = admin.firestore.FieldValue.serverTimestamp();
  const updates = {
    viewCount: admin.firestore.FieldValue.increment(1),
    lastViewedAt: now,
  };
  if (!recipientData.firstViewedAt) updates.firstViewedAt = now;

  await recipientRef.update(updates);

  if (!recipientData.firstViewedAt) {
    // First-view: bump the aggregate viewedCount on the share doc.
    await shareRef.update({
      viewedCount: admin.firestore.FieldValue.increment(1),
    });
  }

  return { ok: true, throttled: false };
}

// ---------------------------------------------------------------------------
// handleConfirmCallSheetShare
// ---------------------------------------------------------------------------

async function handleConfirmCallSheetShare(data, { ip } = {}) {
  const tokenRaw = data?.token;
  const confirm = data?.confirm;
  if (confirm !== true) throw err("confirm must be true.", "invalid-argument");
  const parsed = parseCompoundToken(tokenRaw);
  if (!parsed) throw err("Invalid token.", "invalid-argument");

  const db = admin.firestore();
  const shareRef = db.collection(SHARES_COLLECTION).doc(parsed.shareGroupId);
  const recipientRef = shareRef
    .collection(RECIPIENTS_SUBCOLLECTION)
    .doc(parsed.recipientToken);

  const [shareSnap, recipientSnap] = await Promise.all([shareRef.get(), recipientRef.get()]);
  if (!shareSnap.exists || !recipientSnap.exists) {
    throw err("Share not found.", "not-found");
  }
  const shareData = shareSnap.data();
  const recipientData = recipientSnap.data();

  if (!shareData.enabled) throw err("Share has been revoked.", "failed-precondition");
  if (shareData.expiresAt && shareData.expiresAt.toMillis() < Date.now()) {
    throw err("Share has expired.", "failed-precondition");
  }
  if (recipientData.revokedAt) {
    throw err("Recipient access revoked.", "failed-precondition");
  }

  // Q6 = A: once-confirmed-always-confirmed. Duplicate confirm is a no-op.
  if (recipientData.isConfirmed) {
    return { ok: true, alreadyConfirmed: true };
  }

  const confirmedAtServer = admin.firestore.FieldValue.serverTimestamp();
  const confirmIpHash = hashIp(ip);

  await db.runTransaction(async (tx) => {
    tx.update(recipientRef, {
      isConfirmed: true,
      confirmedAt: confirmedAtServer,
      confirmIpHash,
    });
    tx.update(shareRef, {
      confirmedCount: admin.firestore.FieldValue.increment(1),
    });
  });

  // Send receipt email to the publisher (fail-open).
  const publisher = await resolvePublisher(db, shareData.createdBy);
  const confirmedCountAfter = (shareData.confirmedCount || 0) + 1;
  const confirmedAtLabel = formatConfirmationTime(new Date());

  try {
    await sendCallSheetConfirmationReceipt({
      recipient: {
        name: recipientData.name,
        roleLabel: recipientData.roleLabel,
      },
      share: {
        clientId: shareData.clientId,
        projectId: shareData.projectId,
        scheduleId: shareData.scheduleId,
        projectName: shareData.snapshot?.projectName || "Call Sheet",
        formattedShootDate: formatShootDate(shareData.shootDate),
        confirmedAtLabel,
        confirmedCount: confirmedCountAfter,
        recipientCount: shareData.recipientCount || 0,
      },
      publisher,
    });
  } catch (emailError) {
    console.error("[confirmCallSheetShare] Failed to send receipt email:", emailError);
  }

  return { ok: true, alreadyConfirmed: false };
}

// ---------------------------------------------------------------------------
// handleResendCallSheetShare
// ---------------------------------------------------------------------------

async function handleResendCallSheetShare(data, caller) {
  assertPublisherAuth(caller);
  const shareGroupId = validateString(data?.shareGroupId, "shareGroupId", { max: 128 });
  const tokens = Array.isArray(data?.tokens) ? data.tokens : [];
  if (tokens.length === 0) {
    throw err("At least one recipient token is required for resend.", "invalid-argument");
  }
  if (tokens.length > 200) {
    throw err("Too many tokens (max 200).", "invalid-argument");
  }
  const reason = typeof data?.reason === "string" && data.reason.trim()
    ? data.reason.trim().slice(0, 500)
    : null;

  const db = admin.firestore();
  const shareRef = db.collection(SHARES_COLLECTION).doc(shareGroupId);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) throw err("Share not found.", "not-found");
  const shareData = shareSnap.data();
  if (shareData.clientId !== normalizeClientId(caller)) {
    throw err("You don't have access to this share.", "permission-denied");
  }
  if (!shareData.enabled) {
    throw err("Share is revoked; resend not possible.", "failed-precondition");
  }

  const publisher = await resolvePublisher(db, shareData.createdBy);
  const formattedShootDate = formatShootDate(shareData.shootDate);
  const primaryLocationLabel = shareData.snapshot?.locations?.[0]?.label || null;
  const defaultCallTime = shareData.snapshot?.dayDetails?.generalCallTime || null;
  const expiryLabel = shareData.expiresAt
    ? `Link expires ${formatShootDate(shareData.expiresAt)}`
    : null;

  const results = await Promise.all(tokens.map(async (token) => {
    if (typeof token !== "string" || !token.trim()) {
      return { token, ok: false, error: "invalid_token" };
    }
    const recipientRef = shareRef.collection(RECIPIENTS_SUBCOLLECTION).doc(token);
    const recipientSnap = await recipientRef.get();
    if (!recipientSnap.exists) return { token, ok: false, error: "not_found" };
    const recipient = recipientSnap.data();
    if (recipient.revokedAt) return { token, ok: false, error: "revoked" };

    const originalSentAtLabel = formatConfirmationTime(recipient.emailSentAt);
    const sendResult = await sendCallSheetResendEmail({
      recipient: {
        name: recipient.name,
        email: recipient.email,
        callTime: recipient.callTime,
        roleLabel: recipient.roleLabel,
        token,
        shareGroupId,
      },
      share: {
        projectName: shareData.snapshot?.projectName || "Call Sheet",
        formattedShootDate,
        primaryLocationLabel,
        defaultCallTime,
        projectLogoUrl: shareData.snapshot?.brand?.logoUrl || null,
        emailSubject: shareData.emailSubject,
        emailMessage: shareData.emailMessage,
        requireConfirm: shareData.requireConfirm,
        expiryLabel,
      },
      publisher,
      reason,
      originalSentAtLabel,
    });

    const now = admin.firestore.FieldValue.serverTimestamp();
    const updates = sendResult.ok
      ? {
          emailSentAt: now,
          emailSendError: null,
          emailSendAttempts: admin.firestore.FieldValue.increment(1),
        }
      : {
          emailSendError: sendResult.error || "unknown",
          emailSendAttempts: admin.firestore.FieldValue.increment(1),
        };
    try {
      await recipientRef.update(updates);
    } catch (updateError) {
      console.error(
        `[resendCallSheetShare] Failed to update recipient ${token} status:`,
        updateError,
      );
    }
    return { token, ok: sendResult.ok, error: sendResult.error || null };
  }));

  const failedSends = results.filter((r) => !r.ok).length;
  console.log(
    `[resendCallSheetShare] share=${shareGroupId} attempted=${tokens.length} failed=${failedSends}`,
  );
  return { shareGroupId, attempted: tokens.length, failedSends, results };
}

// ---------------------------------------------------------------------------
// handleRevokeCallSheetShare
// ---------------------------------------------------------------------------

async function handleRevokeCallSheetShare(data, caller) {
  assertPublisherAuth(caller);
  const shareGroupId = validateString(data?.shareGroupId, "shareGroupId", { max: 128 });
  const tokens = Array.isArray(data?.tokens) ? data.tokens.filter(Boolean) : [];

  const db = admin.firestore();
  const shareRef = db.collection(SHARES_COLLECTION).doc(shareGroupId);
  const shareSnap = await shareRef.get();
  if (!shareSnap.exists) throw err("Share not found.", "not-found");
  const shareData = shareSnap.data();
  if (shareData.clientId !== normalizeClientId(caller)) {
    throw err("You don't have access to this share.", "permission-denied");
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  if (tokens.length === 0) {
    // Whole-share revoke: flip enabled=false. Idempotent.
    if (!shareData.enabled) return { shareGroupId, revokedAll: true, alreadyRevoked: true };
    await shareRef.update({ enabled: false });
    return { shareGroupId, revokedAll: true, alreadyRevoked: false };
  }

  const batch = db.batch();
  const updated = [];
  const skipped = [];
  for (const token of tokens) {
    if (typeof token !== "string" || !token.trim()) {
      skipped.push({ token, reason: "invalid_token" });
      continue;
    }
    const recipientRef = shareRef.collection(RECIPIENTS_SUBCOLLECTION).doc(token);
    batch.update(recipientRef, { revokedAt: now });
    updated.push(token);
  }
  try {
    await batch.commit();
  } catch (batchError) {
    throw err(`Failed to revoke recipients: ${batchError.message}`, "internal");
  }
  return { shareGroupId, revokedAll: false, revoked: updated, skipped };
}

module.exports = {
  handlePublishCallSheet,
  handleRecordCallSheetShareView,
  handleConfirmCallSheetShare,
  handleResendCallSheetShare,
  handleRevokeCallSheetShare,
  // Exposed for unit testing:
  parseCompoundToken,
  hashIp,
  formatShootDate,
  formatConfirmationTime,
  validatePublishRecipients,
  VIEW_RATE_LIMIT_MS,
};
