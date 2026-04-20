/**
 * CallSheetShareEmail — Email 1 (initial send) and Email 3 (resend, via the
 * `resend` prop). Rendered per-recipient by the `publishCallSheet` and
 * `resendCallSheetShare` Cloud Functions.
 *
 * Copy pattern matches plan §7.3 Email 1 / Email 3. XSS-safe: all
 * user-supplied strings (`recipientName`, `projectName`, `emailMessage`) are
 * rendered as React Text children, which the `@react-email/render` pipeline
 * escapes for HTML output.
 */

"use strict";

const React = require("react");
const { Section, Text, Hr } = require("@react-email/components");
const EmailLayout = require("./shared/EmailLayout.js");
const EmailHeader = require("./shared/EmailHeader.js");
const EmailButton = require("./shared/EmailButton.js");
const EmailFooter = require("./shared/EmailFooter.js");
const { colors, spacing, type } = require("./shared/tokens.js");

const introSectionStyle = {
  padding: `${spacing.lg} ${spacing.xl} 0`,
};

const paragraphStyle = {
  margin: `0 0 ${spacing.md}`,
  fontSize: type.sizeBody,
  lineHeight: type.lineHeightBody,
  color: colors.textMuted,
};

const detailsParagraphStyle = {
  margin: `0 0 ${spacing.sm}`,
  fontSize: type.sizeBody,
  lineHeight: type.lineHeightBody,
  color: colors.textMuted,
};

const strongStyle = {
  color: colors.text,
  fontWeight: type.weightStrong,
};

const messageBlockStyle = {
  margin: `${spacing.md} 0 ${spacing.lg}`,
  padding: `${spacing.md}`,
  backgroundColor: colors.pageBg,
  borderRadius: "6px",
  fontSize: type.sizeBody,
  lineHeight: type.lineHeightBody,
  color: colors.textMuted,
  whiteSpace: "pre-wrap",
};

const resendBannerStyle = {
  margin: `${spacing.lg} ${spacing.xl} 0`,
  padding: `${spacing.sm} ${spacing.md}`,
  backgroundColor: colors.warningBg,
  borderLeft: `3px solid ${colors.warningBorder}`,
  color: colors.warningText,
  fontSize: type.sizeSmall,
  lineHeight: type.lineHeightBody,
  borderRadius: "4px",
};

const confirmHintStyle = {
  margin: `${spacing.lg} 0 0`,
  fontSize: type.sizeSmall,
  fontStyle: "italic",
  lineHeight: type.lineHeightBody,
  color: colors.textSubtle,
};

const hrStyle = {
  border: "none",
  borderTop: `1px solid ${colors.border}`,
  margin: `${spacing.lg} 0`,
};

/**
 * @param {object} props
 * @param {string} props.recipientName - e.g. "Alex Rivera"
 * @param {string} props.projectName
 * @param {string} props.formattedShootDate - e.g. "Thu, Sep 22, 2026"
 * @param {string | null} props.recipientCallTime - per-recipient call (e.g. "6:30 AM")
 * @param {string | null} props.defaultCallTime - share-level fallback (e.g. "7:00 AM")
 * @param {string | null} props.primaryLocationLabel - e.g. "Unboundmerino Studio A"
 * @param {string} props.publisherName - the producer's display name
 * @param {string} props.publisherEmail
 * @param {string | null} props.emailMessage - producer-supplied free text
 * @param {string} props.shareUrl - full https URL to `/s/:token`
 * @param {string | null} props.projectLogoUrl - brand logo
 * @param {boolean} props.requireConfirm - show the confirm-CTA paragraph
 * @param {boolean} [props.resend] - true for resend email (adds banner)
 * @param {string | null} [props.resendReason] - optional producer note on the resend
 * @param {string | null} [props.originalSentAtLabel] - e.g. "Oct 4 at 9:15 AM"
 * @param {string | null} [props.expiryLabel] - e.g. "Link expires Oct 6, 2026"
 */
function CallSheetShareEmail(props) {
  const {
    recipientName,
    projectName,
    formattedShootDate,
    recipientCallTime,
    defaultCallTime,
    primaryLocationLabel,
    publisherName,
    publisherEmail,
    emailMessage,
    shareUrl,
    projectLogoUrl,
    requireConfirm,
    resend,
    resendReason,
    originalSentAtLabel,
    expiryLabel,
  } = props;

  const callTime = recipientCallTime || defaultCallTime;
  const preview = `Call sheet for ${projectName} on ${formattedShootDate}`;

  const children = [
    React.createElement(EmailHeader, {
      key: "header",
      projectLogoUrl: projectLogoUrl || null,
      projectLogoAlt: projectName,
    }),
  ];

  if (resend) {
    const bannerText = resendReason
      ? `This is a resend of the call sheet originally emailed ${originalSentAtLabel || "earlier"}. Please confirm when you've seen it. Note: ${resendReason}`
      : `This is a resend of the call sheet originally emailed ${originalSentAtLabel || "earlier"}. Please confirm when you've seen it.`;
    children.push(
      React.createElement(
        Section,
        { key: "resend-banner", style: resendBannerStyle },
        bannerText,
      ),
    );
  }

  children.push(
    React.createElement(
      Section,
      { key: "intro", style: introSectionStyle },
      React.createElement(
        Text,
        { style: paragraphStyle },
        `Hi ${recipientName},`,
      ),
      React.createElement(
        Text,
        { style: paragraphStyle },
        "Your call sheet for ",
        React.createElement("strong", { style: strongStyle }, projectName),
        " on ",
        React.createElement("strong", { style: strongStyle }, formattedShootDate),
        " is ready.",
      ),
      callTime
        ? React.createElement(
            Text,
            { style: detailsParagraphStyle },
            "Your call: ",
            React.createElement("strong", { style: strongStyle }, callTime),
          )
        : null,
      primaryLocationLabel
        ? React.createElement(
            Text,
            { style: detailsParagraphStyle },
            "Location: ",
            React.createElement("strong", { style: strongStyle }, primaryLocationLabel),
          )
        : null,
      emailMessage
        ? React.createElement(Text, { style: messageBlockStyle }, emailMessage)
        : null,
    ),
  );

  children.push(
    React.createElement(
      EmailButton,
      { key: "cta", href: shareUrl },
      "View Call Sheet",
    ),
  );

  if (requireConfirm) {
    children.push(
      React.createElement(
        Section,
        { key: "confirm-hint", style: introSectionStyle },
        React.createElement(Hr, { style: hrStyle }),
        React.createElement(
          Text,
          { style: confirmHintStyle },
          `${publisherName} asked you to confirm you've received this. You can confirm from the call sheet link above.`,
        ),
        React.createElement(
          Text,
          { style: confirmHintStyle },
          "Questions? Reply to this email — ",
          publisherEmail,
          " will see it.",
        ),
      ),
    );
  }

  children.push(
    React.createElement(EmailFooter, {
      key: "footer",
      publisherEmail,
      expiryLabel: expiryLabel || null,
    }),
  );

  return React.createElement(EmailLayout, { preview }, children);
}

module.exports = CallSheetShareEmail;
module.exports.default = CallSheetShareEmail;
