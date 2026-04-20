/**
 * Thin wrapper around `@react-email/render` so each template module only
 * exports a React element factory. Keeps the render flag shape (`pretty:
 * false`, `plainText: true`) consistent across templates.
 */

"use strict";

const React = require("react");
const { render } = require("@react-email/render");

/**
 * @param {Function} TemplateComponent - React component factory
 * @param {object} props
 * @returns {Promise<string>} HTML string
 */
async function renderHtml(TemplateComponent, props) {
  return render(React.createElement(TemplateComponent, props), {
    pretty: false,
  });
}

/**
 * @param {Function} TemplateComponent - React component factory
 * @param {object} props
 * @returns {Promise<string>} plain text string
 */
async function renderText(TemplateComponent, props) {
  return render(React.createElement(TemplateComponent, props), {
    plainText: true,
  });
}

module.exports = { renderHtml, renderText };
