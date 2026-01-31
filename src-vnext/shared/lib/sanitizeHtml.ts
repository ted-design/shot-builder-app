/**
 * HTML sanitization utility using DOMPurify.
 * Ported from legacy src/lib/sanitizeHtml.ts for vNext.
 *
 * Used to render legacy rich-text notes safely as read-only HTML.
 * NEVER use this to enable write-back of HTML content — legacy notes
 * are read-only in vNext. Use notesAddendum for new text.
 */
import DOMPurify from "dompurify"

const ALLOWED_CSS_PROPERTIES = new Set(["color", "background-color"])
const MAX_STYLE_LENGTH = 500

const VALID_COLOR_PATTERNS = [
  /^#[0-9a-f]{3}$/i,
  /^#[0-9a-f]{6}$/i,
  /^#[0-9a-f]{8}$/i,
  /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i,
  /^rgb\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*(?:\/\s*[\d.]+%?\s*)?\)$/i,
  /^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[\d.]+%?\s*\)$/i,
  /^rgba\(\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}\s*\/\s*[\d.]+%?\s*\)$/i,
  /^hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)$/i,
  /^hsl\(\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*(?:\/\s*[\d.]+%?\s*)?\)$/i,
  /^hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*[\d.]+%?\s*\)$/i,
  /^hsla\(\s*\d{1,3}\s+\d{1,3}%\s+\d{1,3}%\s*\/\s*[\d.]+%?\s*\)$/i,
  /^[a-z]+$/i,
]

const DANGEROUS_PATTERNS = [
  /url\s*\(/i,
  /expression\s*\(/i,
  /javascript\s*:/i,
  /data\s*:/i,
  /-moz-binding/i,
  /behavior\s*:/i,
]

function isValidColorValue(value: string): boolean {
  const trimmed = value.trim()
  return VALID_COLOR_PATTERNS.some((pattern) => pattern.test(trimmed))
}

function hasDangerousContent(value: string): boolean {
  return DANGEROUS_PATTERNS.some((pattern) => pattern.test(value))
}

function filterStyleAttribute(styleValue: string): string {
  if (!styleValue || typeof styleValue !== "string") return ""
  if (styleValue.length > MAX_STYLE_LENGTH) return ""
  if (hasDangerousContent(styleValue)) return ""

  const safeDeclarations: string[] = []
  const declarations = styleValue.split(";")

  for (const declaration of declarations) {
    const trimmed = declaration.trim()
    if (!trimmed) continue

    const colonIndex = trimmed.indexOf(":")
    if (colonIndex === -1) continue

    const property = trimmed.slice(0, colonIndex).trim().toLowerCase()
    const value = trimmed.slice(colonIndex + 1).trim()

    if (!property || !value) continue
    if (!ALLOWED_CSS_PROPERTIES.has(property)) continue
    if (!isValidColorValue(value)) continue
    if (hasDangerousContent(value)) continue

    safeDeclarations.push(`${property}: ${value}`)
  }

  return safeDeclarations.join("; ")
}

const SANITIZE_CONFIG = {
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM: false,
  ALLOWED_TAGS: [
    "p", "br", "span", "div", "strong", "em", "b", "i", "u", "s",
    "code", "pre", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "blockquote", "a", "img",
    "table", "thead", "tbody", "tr", "th", "td", "hr", "sub", "sup",
  ],
  ALLOWED_ATTR: [
    "class", "style", "href", "target", "rel",
    "src", "alt", "width", "height", "colspan", "rowspan",
  ],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
}

let hooksRegistered = false

function registerSanitizeHooks() {
  if (hooksRegistered) return

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof Element && node.hasAttribute("style")) {
      const originalStyle = node.getAttribute("style") ?? ""
      const filteredStyle = filterStyleAttribute(originalStyle)
      if (filteredStyle) {
        node.setAttribute("style", filteredStyle)
      } else {
        node.removeAttribute("style")
      }
    }
  })

  hooksRegistered = true
}

registerSanitizeHooks()

export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== "string") return ""
  return DOMPurify.sanitize(html, SANITIZE_CONFIG) as string
}

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html || typeof html !== "string") return true
  const stripped = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .trim()
  return stripped.length === 0
}
