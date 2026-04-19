/**
 * EmailFooter — reply-to guidance, expiry notice, and an "if you received
 * this in error" fallback. Always rendered below the CTA.
 */

"use strict";

const React = require("react");
const { Section, Text, Link, Hr } = require("@react-email/components");
const { colors, spacing, type } = require("./tokens.js");

const sectionStyle = {
  padding: `0 ${spacing.xl} ${spacing.xl}`,
};

const hrStyle = {
  borderTop: `1px solid ${colors.border}`,
  borderBottom: "none",
  borderLeft: "none",
  borderRight: "none",
  margin: 0,
};

const metaStyle = {
  margin: `${spacing.md} 0 0`,
  fontSize: type.sizeMeta,
  lineHeight: "1.5",
  color: colors.textTertiary,
};

const linkStyle = {
  color: colors.textSubtle,
};

/**
 * @param {object} props
 * @param {string} props.publisherEmail - the producer's email for reply-to guidance
 * @param {string | null} [props.expiryLabel] - e.g. "Link expires Oct 6, 2026"
 */
function EmailFooter({ publisherEmail, expiryLabel }) {
  return React.createElement(
    Section,
    { style: sectionStyle },
    React.createElement(Hr, { style: hrStyle }),
    expiryLabel
      ? React.createElement(
          Text,
          { style: metaStyle },
          expiryLabel,
        )
      : null,
    React.createElement(
      Text,
      { style: metaStyle },
      "If you received this email in error, reply to ",
      React.createElement(
        Link,
        { href: `mailto:${publisherEmail}`, style: linkStyle },
        publisherEmail,
      ),
      " and we'll remove you from this call sheet.",
    ),
  );
}

module.exports = EmailFooter;
module.exports.default = EmailFooter;
