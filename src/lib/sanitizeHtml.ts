/**
 * Shared HTML sanitization utility using DOMPurify.
 * Used by RichTextEditor and preview components to ensure consistent sanitization.
 */
import DOMPurify from "dompurify";

/**
 * Whitelist of allowed CSS properties in style attributes.
 * Only color-related properties are permitted for security.
 */
const ALLOWED_CSS_PROPERTIES = new Set(["color", "background-color"]);

/**
 * Regex patterns for valid CSS color values.
 * Allows hex (#rgb, #rrggbb, #rrggbbaa), rgb(), rgba(), hsl(), hsla(), and named colors.
 * Supports both legacy comma-separated and modern space-separated CSS color syntax.
 */
const VALID_COLOR_PATTERNS = [
  /^#[0-9a-f]{3}$/i, // #rgb
  /^#[0-9a-f]{6}$/i, // #rrggbb
  /^#[0-9a-f]{8}$/i, // #rrggbbaa
  // Legacy comma-separated: rgb(r, g, b)
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  // Modern space-separated: rgb(r g b) or rgb(r g b / a)
  /^rgb\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(?:\/\s*[\d.]+%?\s*)?\)$/i,
  // Legacy comma-separated: rgba(r, g, b, a)
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+%?\s*\)$/i,
  // Modern space-separated: rgba(r g b / a)
  /^rgba\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*\/\s*[\d.]+%?\s*\)$/i,
  // Legacy comma-separated: hsl(h, s%, l%)
  /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/i,
  // Modern space-separated: hsl(h s% l%) or hsl(h s% l% / a)
  /^hsl\(\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*(?:\/\s*[\d.]+%?\s*)?\)$/i,
  // Legacy comma-separated: hsla(h, s%, l%, a)
  /^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*[\d.]+%?\s*\)$/i,
  // Modern space-separated: hsla(h s% l% / a)
  /^hsla\(\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*\/\s*[\d.]+%?\s*\)$/i,
  /^[a-z]+$/i, // named colors (red, blue, etc.)
];

/**
 * Dangerous patterns that should never appear in style values.
 * Blocks XSS vectors like url(), expression(), javascript:, etc.
 */
const DANGEROUS_PATTERNS = [
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /data\s*:/i,
  /-moz-binding/i,
  /behavior\s*:/i,
];

/**
 * Check if a CSS value is a valid color.
 */
function isValidColorValue(value: string): boolean {
  const trimmed = value.trim();
  return VALID_COLOR_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Check if a style value contains dangerous patterns.
 */
function hasDangerousContent(value: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * Filter a style attribute to only allow safe color properties.
 * Returns the filtered style string, or empty string if nothing is safe.
 */
function filterStyleAttribute(styleValue: string): string {
  // Reject entirely if it contains dangerous patterns
  if (hasDangerousContent(styleValue)) {
    return "";
  }

  const safeDeclarations: string[] = [];

  // Parse style declarations (split by semicolon)
  const declarations = styleValue.split(";");

  for (const declaration of declarations) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    // Split into property and value
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const property = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    // Only allow whitelisted properties
    if (!ALLOWED_CSS_PROPERTIES.has(property)) continue;

    // Validate the value is a legitimate color
    if (!isValidColorValue(value)) continue;

    // Double-check value doesn't contain dangerous content
    if (hasDangerousContent(value)) continue;

    safeDeclarations.push(`${property}: ${value}`);
  }

  return safeDeclarations.join("; ");
}

/**
 * DOMPurify configuration for rich text content.
 * Allows comprehensive HTML tags for rich text editing while preventing XSS attacks.
 */
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "span",
    "div",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "s",
    "code",
    "pre",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "hr",
    "sub",
    "sup",
  ],
  ALLOWED_ATTR: [
    "class",
    "style",
    "href",
    "target",
    "rel",
    "src",
    "alt",
    "width",
    "height",
    "colspan",
    "rowspan",
  ],
  ALLOW_DATA_ATTR: true, // For mentions and other data attributes
  KEEP_CONTENT: true,
};

// Flag to track if hooks are already registered
let hooksRegistered = false;

/**
 * Register DOMPurify hooks to filter style attributes.
 * Only registers once to avoid duplicate hooks.
 */
function registerSanitizeHooks(): void {
  if (hooksRegistered) return;

  // Hook that runs after each element is sanitized
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof Element && node.hasAttribute("style")) {
      const originalStyle = node.getAttribute("style") || "";
      const filteredStyle = filterStyleAttribute(originalStyle);

      if (filteredStyle) {
        node.setAttribute("style", filteredStyle);
      } else {
        node.removeAttribute("style");
      }
    }
  });

  hooksRegistered = true;
}

// Register hooks on module load
registerSanitizeHooks();

/**
 * Sanitize HTML string using DOMPurify with the shared configuration.
 * Style attributes are filtered to only allow safe color properties.
 * @param html - The HTML string to sanitize
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return "";
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
}

/**
 * Check if a string contains meaningful HTML content (not just plain text or empty tags).
 * Used to determine whether to render richText or fall back to plain value.
 */
export function hasRichContent(html: string | null | undefined): boolean {
  if (!html || typeof html !== "string") return false;
  // Check if there's actual content after stripping tags
  const stripped = html.replace(/<[^>]*>/g, "").trim();
  // Also check for inline styles/formatting that matter
  const hasFormatting =
    /<(strong|em|b|i|u|s|a)\b/i.test(html) || /style\s*=/i.test(html);
  return stripped.length > 0 || hasFormatting;
}
