/**
 * EmailButton — primary CTA used by all call-sheet share templates. Consistent
 * dark-on-light styling that matches the in-app `<Button>` primitive.
 */

"use strict";

const React = require("react");
const { Section, Button } = require("@react-email/components");
const { colors, spacing, type, radii } = require("./tokens.js");

const sectionStyle = {
  padding: `0 ${spacing.xl} ${spacing.xl}`,
  textAlign: "center",
};

const buttonStyle = {
  display: "inline-block",
  padding: `12px 32px`,
  backgroundColor: colors.primary,
  color: colors.primaryText,
  textDecoration: "none",
  borderRadius: radii.button,
  fontSize: type.sizeSmall,
  fontWeight: type.weightStrong,
  lineHeight: 1,
};

function EmailButton({ href, children }) {
  return React.createElement(
    Section,
    { style: sectionStyle },
    React.createElement(
      Button,
      { href, style: buttonStyle },
      children,
    ),
  );
}

module.exports = EmailButton;
module.exports.default = EmailButton;
