/**
 * EmailLayout — outer <Html><Head><Body><Container> wrapper shared by all
 * call-sheet share templates. Keeps background, max-width and base typography
 * consistent between the initial-send email, the resend, and the publisher
 * confirmation receipt.
 */

"use strict";

const React = require("react");
const {
  Html,
  Head,
  Body,
  Container,
  Preview,
} = require("@react-email/components");
const { colors, spacing, type } = require("./tokens.js");

const bodyStyle = {
  margin: 0,
  padding: 0,
  backgroundColor: colors.pageBg,
  fontFamily: type.fontFamily,
  color: colors.text,
};

const containerStyle = {
  maxWidth: "520px",
  margin: `${spacing.xxl} auto`,
  backgroundColor: colors.surface,
  borderRadius: "8px",
  overflow: "hidden",
};

function EmailLayout({ preview, children }) {
  return React.createElement(
    Html,
    { lang: "en" },
    React.createElement(Head, null),
    preview ? React.createElement(Preview, null, preview) : null,
    React.createElement(
      Body,
      { style: bodyStyle },
      React.createElement(Container, { style: containerStyle }, children),
    ),
  );
}

module.exports = EmailLayout;
module.exports.default = EmailLayout;
