/**
 * EmailHeader — "Production Hub" wordmark + optional project logo.
 *
 * Kept deliberately lightweight: table-based layout is handled by the
 * `@react-email/components` primitives; we only supply the content.
 */

"use strict";

const React = require("react");
const { Section, Img, Text } = require("@react-email/components");
const { colors, spacing, type, appName } = require("./tokens.js");

const sectionStyle = {
  padding: `${spacing.xl} ${spacing.xl} 0`,
};

const wordmarkStyle = {
  margin: 0,
  fontSize: type.sizeH1,
  fontWeight: type.weightHeading,
  color: colors.text,
  letterSpacing: type.letterSpacingHeading,
  lineHeight: type.lineHeightTight,
};

const projectLogoStyle = {
  display: "block",
  marginBottom: spacing.md,
  maxHeight: "40px",
  maxWidth: "180px",
};

function EmailHeader({ projectLogoUrl, projectLogoAlt }) {
  return React.createElement(
    Section,
    { style: sectionStyle },
    projectLogoUrl
      ? React.createElement(Img, {
          src: projectLogoUrl,
          alt: projectLogoAlt || "",
          style: projectLogoStyle,
        })
      : null,
    React.createElement(Text, { style: wordmarkStyle }, appName),
  );
}

module.exports = EmailHeader;
module.exports.default = EmailHeader;
