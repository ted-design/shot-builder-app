/**
 * CallSheetConfirmationReceipt — Email 2 per plan §7.3. Sent to the publisher
 * whenever a recipient flips `isConfirmed: true` via the reader.
 */

"use strict";

const React = require("react");
const { Section, Text } = require("@react-email/components");
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

const strongStyle = {
  color: colors.text,
  fontWeight: type.weightStrong,
};

const countStyle = {
  margin: `${spacing.lg} 0 0`,
  fontSize: type.sizeSmall,
  lineHeight: type.lineHeightBody,
  color: colors.textSubtle,
};

/**
 * @param {object} props
 * @param {string} props.recipientName
 * @param {string | null} props.recipientRoleLabel
 * @param {string} props.projectName
 * @param {string} props.formattedShootDate
 * @param {string} props.confirmedAtLabel
 * @param {number} props.confirmedCount
 * @param {number} props.recipientCount
 * @param {string} props.recipientsUrl - deep link to CallSheetBuilderPage#recipients
 * @param {string} props.publisherEmail
 */
function CallSheetConfirmationReceipt(props) {
  const {
    recipientName,
    recipientRoleLabel,
    projectName,
    formattedShootDate,
    confirmedAtLabel,
    confirmedCount,
    recipientCount,
    recipientsUrl,
    publisherEmail,
  } = props;

  const preview = `${recipientName} confirmed ${projectName} call sheet`;
  const roleSuffix = recipientRoleLabel ? ` (${recipientRoleLabel})` : "";

  return React.createElement(
    EmailLayout,
    { preview },
    React.createElement(EmailHeader, { projectLogoUrl: null }),
    React.createElement(
      Section,
      { style: introSectionStyle },
      React.createElement(
        Text,
        { style: paragraphStyle },
        React.createElement("strong", { style: strongStyle }, `${recipientName}${roleSuffix}`),
        " confirmed they've received the call sheet for ",
        React.createElement("strong", { style: strongStyle }, projectName),
        " on ",
        React.createElement("strong", { style: strongStyle }, formattedShootDate),
        " at ",
        React.createElement("strong", { style: strongStyle }, confirmedAtLabel),
        ".",
      ),
    ),
    React.createElement(
      EmailButton,
      { href: recipientsUrl },
      "View Recipients",
    ),
    React.createElement(
      Section,
      { style: introSectionStyle },
      React.createElement(
        Text,
        { style: countStyle },
        `${confirmedCount} of ${recipientCount} recipients have now confirmed.`,
      ),
    ),
    React.createElement(EmailFooter, { publisherEmail }),
  );
}

module.exports = CallSheetConfirmationReceipt;
module.exports.default = CallSheetConfirmationReceipt;
