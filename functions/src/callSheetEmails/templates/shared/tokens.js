/**
 * Design tokens for React Email templates (Phase 3 publishing).
 *
 * Intentionally duplicated from the main app's design system: email HTML
 * requires table-based inline-styled markup which does not benefit from the
 * app's token pipeline. See plan §7.2 for rationale.
 *
 * Values match `src-vnext/shared/styles/tokens.css` as of 2026-04-19:
 *   - primary foreground (#18181b)
 *   - muted foreground (#71717a)
 *   - border (#e4e4e7)
 *   - page background (#f4f4f5)
 *   - surface (#ffffff)
 */

"use strict";

const colors = {
  text: "#18181b",
  textMuted: "#3f3f46",
  textSubtle: "#71717a",
  textTertiary: "#a1a1aa",
  border: "#e4e4e7",
  surface: "#ffffff",
  pageBg: "#f4f4f5",
  primary: "#18181b",
  primaryText: "#ffffff",
  successBg: "#dcfce7",
  successText: "#166534",
  warningBg: "#fef3c7",
  warningText: "#854d0e",
  warningBorder: "#fde68a",
};

const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  xxl: "40px",
};

const type = {
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  sizeH1: "20px",
  sizeBody: "15px",
  sizeSmall: "14px",
  sizeMeta: "12px",
  weightHeading: "300",
  weightBody: "400",
  weightStrong: "500",
  lineHeightBody: "1.6",
  lineHeightTight: "1.4",
  letterSpacingHeading: "-0.01em",
};

const radii = {
  card: "8px",
  button: "6px",
  chip: "4px",
};

const appName = "Production Hub";

module.exports = { colors, spacing, type, radii, appName };
