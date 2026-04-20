/**
 * Public API for the call-sheet email module (Phase 3 publishing).
 *
 * Three sendXxx functions map to the three email variants in plan §7.3:
 *   1. `sendCallSheetShareEmail` — initial send to each recipient.
 *   2. `sendCallSheetConfirmationReceipt` — to publisher when recipient confirms.
 *   3. `sendCallSheetResendEmail` — producer-triggered resend (same template,
 *      `resend: true` flag adds a yellow banner and `[Resend]` subject prefix).
 *
 * Resend API key resolution, fail-open posture, and logging match the existing
 * `functions/email.js` pattern (single shared `Resend` client; missing key is
 * a warning not a crash).
 */

"use strict";

const { Resend } = require("resend");
const CallSheetShareEmail = require("./templates/CallSheetShareEmail.js");
const CallSheetConfirmationReceipt = require("./templates/CallSheetConfirmationReceipt.js");
const { renderHtml, renderText } = require("./render.js");

const APP_NAME = "Production Hub";
const FROM_ADDRESS = `${APP_NAME} <noreply@unboundmerino.immediategroup.ca>`;
const DEFAULT_APP_URL = "https://um-shotbuilder.web.app";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[callSheetEmails] RESEND_API_KEY not configured — emails will be skipped");
    return null;
  }
  return new Resend(apiKey);
}

function getAppUrl() {
  return process.env.APP_URL || DEFAULT_APP_URL;
}

/**
 * Build the per-recipient `/s/:token` URL. Token format is the compound
 * `{shareGroupId}.{recipientToken}` per plan §3 / zod schema.
 *
 * @param {string} shareGroupId
 * @param {string} recipientToken
 * @param {string} [appUrl]
 */
function buildShareUrl(shareGroupId, recipientToken, appUrl) {
  const base = (appUrl || getAppUrl()).replace(/\/$/, "");
  return `${base}/s/${shareGroupId}.${recipientToken}`;
}

/**
 * Build the producer's deep link back to the call-sheet builder with the
 * recipients panel scrolled into view.
 */
function buildRecipientsPanelUrl({ clientId, projectId, scheduleId, appUrl }) {
  const base = (appUrl || getAppUrl()).replace(/\/$/, "");
  return `${base}/clients/${clientId}/projects/${projectId}/schedules/${scheduleId}/callsheet#recipients`;
}

/**
 * Default subject line builder used when the publisher didn't override the
 * subject. Matches plan §7.3 Email 1.
 */
function buildDefaultSubject({ projectName, formattedShootDate }) {
  return `${projectName} — Call Sheet for ${formattedShootDate}`;
}

/**
 * Email 1 — initial send to a recipient.
 *
 * @param {object} params
 * @param {object} params.recipient - recipient shape { name, email, roleLabel, callTime, precallTime, token, shareGroupId }
 * @param {object} params.share - { projectName, formattedShootDate, primaryLocationLabel, defaultCallTime, projectLogoUrl, emailSubject, emailMessage, requireConfirm, expiryLabel }
 * @param {object} params.publisher - { name, email }
 * @param {string} [params.appUrl] - override for APP_URL env var (for testing)
 * @returns {Promise<{ok: boolean, error?: string, id?: string}>}
 */
async function sendCallSheetShareEmail({ recipient, share, publisher, appUrl }) {
  const resend = getResendClient();
  const shareUrl = buildShareUrl(recipient.shareGroupId, recipient.token, appUrl);

  const templateProps = {
    recipientName: recipient.name,
    projectName: share.projectName,
    formattedShootDate: share.formattedShootDate,
    recipientCallTime: recipient.callTime || null,
    defaultCallTime: share.defaultCallTime || null,
    primaryLocationLabel: share.primaryLocationLabel || null,
    publisherName: publisher.name,
    publisherEmail: publisher.email,
    emailMessage: share.emailMessage || null,
    shareUrl,
    projectLogoUrl: share.projectLogoUrl || null,
    requireConfirm: Boolean(share.requireConfirm),
    resend: false,
    resendReason: null,
    originalSentAtLabel: null,
    expiryLabel: share.expiryLabel || null,
  };

  let html;
  let text;
  try {
    html = await renderHtml(CallSheetShareEmail, templateProps);
    text = await renderText(CallSheetShareEmail, templateProps);
  } catch (error) {
    console.error(`[callSheetEmails] Template render failed for ${recipient.email}:`, error);
    return { ok: false, error: `render_failed: ${error.message}` };
  }

  const subject = share.emailSubject || buildDefaultSubject({
    projectName: share.projectName,
    formattedShootDate: share.formattedShootDate,
  });

  if (!resend) {
    console.log(`[callSheetEmails] Skipping share email to ${recipient.email} — Resend not configured`);
    return { ok: false, error: "resend_not_configured" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient.email,
      reply_to: publisher.email,
      subject,
      html,
      text,
    });
    console.log(`[callSheetEmails] Share email sent to ${recipient.email}:`, result?.data?.id);
    return { ok: true, id: result?.data?.id };
  } catch (error) {
    console.error(`[callSheetEmails] Failed to send share email to ${recipient.email}:`, error);
    return { ok: false, error: `send_failed: ${error.message || "unknown"}` };
  }
}

/**
 * Email 3 — resend of the initial email. Same template with a banner.
 */
async function sendCallSheetResendEmail({ recipient, share, publisher, appUrl, reason, originalSentAtLabel }) {
  const resend = getResendClient();
  const shareUrl = buildShareUrl(recipient.shareGroupId, recipient.token, appUrl);

  const templateProps = {
    recipientName: recipient.name,
    projectName: share.projectName,
    formattedShootDate: share.formattedShootDate,
    recipientCallTime: recipient.callTime || null,
    defaultCallTime: share.defaultCallTime || null,
    primaryLocationLabel: share.primaryLocationLabel || null,
    publisherName: publisher.name,
    publisherEmail: publisher.email,
    emailMessage: share.emailMessage || null,
    shareUrl,
    projectLogoUrl: share.projectLogoUrl || null,
    requireConfirm: Boolean(share.requireConfirm),
    resend: true,
    resendReason: reason || null,
    originalSentAtLabel: originalSentAtLabel || null,
    expiryLabel: share.expiryLabel || null,
  };

  let html;
  let text;
  try {
    html = await renderHtml(CallSheetShareEmail, templateProps);
    text = await renderText(CallSheetShareEmail, templateProps);
  } catch (error) {
    console.error(`[callSheetEmails] Resend render failed for ${recipient.email}:`, error);
    return { ok: false, error: `render_failed: ${error.message}` };
  }

  const baseSubject = share.emailSubject || buildDefaultSubject({
    projectName: share.projectName,
    formattedShootDate: share.formattedShootDate,
  });
  const subject = `[Resend] ${baseSubject}`;

  if (!resend) {
    console.log(`[callSheetEmails] Skipping resend email to ${recipient.email} — Resend not configured`);
    return { ok: false, error: "resend_not_configured" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: recipient.email,
      reply_to: publisher.email,
      subject,
      html,
      text,
    });
    console.log(`[callSheetEmails] Resend email sent to ${recipient.email}:`, result?.data?.id);
    return { ok: true, id: result?.data?.id };
  } catch (error) {
    console.error(`[callSheetEmails] Failed to send resend email to ${recipient.email}:`, error);
    return { ok: false, error: `send_failed: ${error.message || "unknown"}` };
  }
}

/**
 * Email 2 — confirmation receipt to the publisher.
 */
async function sendCallSheetConfirmationReceipt({ recipient, share, publisher, appUrl }) {
  const resend = getResendClient();
  const recipientsUrl = buildRecipientsPanelUrl({
    clientId: share.clientId,
    projectId: share.projectId,
    scheduleId: share.scheduleId,
    appUrl,
  });

  const templateProps = {
    recipientName: recipient.name,
    recipientRoleLabel: recipient.roleLabel || null,
    projectName: share.projectName,
    formattedShootDate: share.formattedShootDate,
    confirmedAtLabel: share.confirmedAtLabel,
    confirmedCount: share.confirmedCount,
    recipientCount: share.recipientCount,
    recipientsUrl,
    publisherEmail: publisher.email,
  };

  let html;
  let text;
  try {
    html = await renderHtml(CallSheetConfirmationReceipt, templateProps);
    text = await renderText(CallSheetConfirmationReceipt, templateProps);
  } catch (error) {
    console.error(`[callSheetEmails] Receipt render failed for ${publisher.email}:`, error);
    return { ok: false, error: `render_failed: ${error.message}` };
  }

  const roleSuffix = recipient.roleLabel ? ` (${recipient.roleLabel})` : "";
  const subject = `${recipient.name}${roleSuffix} confirmed the call sheet for ${share.formattedShootDate}`;

  if (!resend) {
    console.log(`[callSheetEmails] Skipping confirmation receipt to ${publisher.email} — Resend not configured`);
    return { ok: false, error: "resend_not_configured" };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: publisher.email,
      subject,
      html,
      text,
    });
    console.log(`[callSheetEmails] Confirmation receipt sent to ${publisher.email}:`, result?.data?.id);
    return { ok: true, id: result?.data?.id };
  } catch (error) {
    console.error(`[callSheetEmails] Failed to send confirmation receipt to ${publisher.email}:`, error);
    return { ok: false, error: `send_failed: ${error.message || "unknown"}` };
  }
}

module.exports = {
  sendCallSheetShareEmail,
  sendCallSheetResendEmail,
  sendCallSheetConfirmationReceipt,
  // Exposed for tests:
  buildShareUrl,
  buildRecipientsPanelUrl,
  buildDefaultSubject,
  renderHtml,
  renderText,
  CallSheetShareEmail,
  CallSheetConfirmationReceipt,
};
