// functions/email.js — Resend email service for invitation notifications
const { Resend } = require("resend");

const APP_NAME = "Production Hub";
const FROM_ADDRESS = `${APP_NAME} <noreply@unboundmerino.immediategroup.ca>`;
const DEFAULT_APP_URL = "https://um-shotbuilder.web.app";

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not configured — emails will be skipped");
    return null;
  }
  return new Resend(apiKey);
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getRoleLabel(role) {
  const labels = {
    admin: "Admin",
    producer: "Producer",
    crew: "Crew",
    warehouse: "Warehouse",
    viewer: "Viewer",
  };
  return labels[role] || role;
}

function getAppUrl() {
  return process.env.APP_URL || DEFAULT_APP_URL;
}

function buildInvitationHtml({ inviterName, role, inviterEmail }) {
  const appUrl = getAppUrl();
  const roleLabel = escapeHtml(getRoleLabel(role));
  const safeName = escapeHtml(inviterName);
  const safeEmail = escapeHtml(inviterEmail);

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="padding:32px 32px 0">
          <h1 style="margin:0 0 24px;font-size:20px;font-weight:300;color:#18181b;letter-spacing:-0.01em">${APP_NAME}</h1>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">
            ${safeName} has invited you to join <strong>${APP_NAME}</strong> as a <strong>${roleLabel}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#71717a">
            ${APP_NAME} is your team's production planning tool for managing shoots, products, and team coordination.
          </p>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 32px">
          <a href="${appUrl}" target="_blank" style="display:inline-block;padding:12px 32px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
            Sign In to Get Started
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;border-top:1px solid #e4e4e7">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa">
            If you have questions, contact <a href="mailto:${safeEmail}" style="color:#71717a">${safeEmail}</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildInvitationText({ inviterName, role, inviterEmail }) {
  const appUrl = getAppUrl();
  const roleLabel = getRoleLabel(role);

  return [
    APP_NAME,
    "",
    `${inviterName} has invited you to join ${APP_NAME} as a ${roleLabel}.`,
    "",
    `${APP_NAME} is your team's production planning tool for managing shoots, products, and team coordination.`,
    "",
    `Sign in to get started: ${appUrl}`,
    "",
    `If you have questions, contact ${inviterEmail}.`,
  ].join("\n");
}

async function sendInvitationEmail({ to, role, inviterName, inviterEmail }) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[email] Skipping invitation email to ${to} — Resend not configured`);
    return;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      reply_to: "ted@immediategroup.ca",
      subject: `You've been invited to ${APP_NAME}`,
      html: buildInvitationHtml({ inviterName, role, inviterEmail }),
      text: buildInvitationText({ inviterName, role, inviterEmail }),
    });
    console.log(`[email] Invitation email sent to ${to}:`, result);
  } catch (error) {
    console.error(`[email] Failed to send invitation email to ${to}:`, error);
    // Non-blocking — invitation is still valid without the email
  }
}

function buildRequestNotificationHtml({ requestTitle, submitterName, priority, requestUrl }) {
  const safeTitle = escapeHtml(requestTitle);
  const safeName = escapeHtml(submitterName);
  const isUrgent = priority === "urgent";
  const urgentBadge = isUrgent
    ? `<span style="display:inline-block;padding:2px 8px;background:#fef2f2;color:#dc2626;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:0.05em;margin-bottom:12px">URGENT</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 20px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:8px;overflow:hidden">
        <tr><td style="padding:32px 32px 0">
          <h1 style="margin:0 0 24px;font-size:20px;font-weight:300;color:#18181b;letter-spacing:-0.01em">${APP_NAME}</h1>
          ${urgentBadge}
          <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#3f3f46">
            <strong>${safeName}</strong> submitted a new shot request.
          </p>
          <p style="margin:0 0 24px;font-size:16px;font-weight:500;line-height:1.4;color:#18181b">
            ${safeTitle}
          </p>
        </td></tr>
        <tr><td align="center" style="padding:0 32px 32px">
          <a href="${requestUrl}" target="_blank" style="display:inline-block;padding:12px 32px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500">
            View Request
          </a>
        </td></tr>
        <tr><td style="padding:0 32px 32px;border-top:1px solid #e4e4e7">
          <p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#a1a1aa">
            You received this because you are an admin or producer on ${APP_NAME}. Reply to <a href="mailto:ted@immediategroup.ca" style="color:#71717a">ted@immediategroup.ca</a> with any questions.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildRequestNotificationText({ requestTitle, submitterName, priority, requestUrl }) {
  const isUrgent = priority === "urgent";
  const lines = [APP_NAME, ""];
  if (isUrgent) lines.push("[URGENT]", "");
  lines.push(
    `${submitterName} submitted a new shot request:`,
    "",
    requestTitle,
    "",
    `View request: ${requestUrl}`,
    "",
    `You received this because you are an admin or producer on ${APP_NAME}.`,
  );
  return lines.join("\n");
}

async function sendRequestNotificationEmail({ to, requestTitle, submitterName, priority, requestUrl }) {
  const resend = getResendClient();
  if (!resend) {
    console.log(`[email] Skipping request notification — Resend not configured`);
    return;
  }

  const isUrgent = priority === "urgent";
  const subject = isUrgent
    ? `[URGENT] New shot request: ${requestTitle}`
    : `New shot request: ${requestTitle}`;

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      reply_to: "ted@immediategroup.ca",
      subject,
      html: buildRequestNotificationHtml({ requestTitle, submitterName, priority, requestUrl }),
      text: buildRequestNotificationText({ requestTitle, submitterName, priority, requestUrl }),
    });
    console.log(`[email] Request notification sent to ${Array.isArray(to) ? to.length : 1} recipient(s):`, result);
  } catch (error) {
    console.error("[email] Failed to send request notification:", error);
    // Non-blocking — notification failure does not affect the request
  }
}

module.exports = { sendInvitationEmail, sendRequestNotificationEmail };
