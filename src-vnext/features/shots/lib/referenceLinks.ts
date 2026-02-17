import type { ShotReferenceLink, ShotReferenceLinkType } from "@/shared/types"

const VIDEO_HOST_TOKENS: ReadonlyArray<string> = [
  "youtube.com",
  "youtu.be",
  "vimeo.com",
  "loom.com",
  "wistia.com",
]

const VIDEO_EXT_RE = /\.(mp4|mov|m4v|webm|mkv)(?:$|[?#])/i
const DOC_EXT_RE = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf)(?:$|[?#])/i

function safeUrl(input: string): URL | null {
  try {
    return new URL(input)
  } catch {
    return null
  }
}

function hasSupportedProtocol(url: URL): boolean {
  return url.protocol === "https:" || url.protocol === "http:"
}

export function normalizeReferenceLinkUrl(input: unknown): string | null {
  if (typeof input !== "string") return null
  const trimmed = input.trim()
  if (!trimmed) return null

  const withProtocol = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  const parsed = safeUrl(withProtocol)
  if (!parsed || !hasSupportedProtocol(parsed)) return null

  parsed.hash = parsed.hash.trim()
  return parsed.toString()
}

export function inferReferenceLinkType(url: string): ShotReferenceLinkType {
  const parsed = safeUrl(url)
  if (!parsed) return "web"

  const hostname = parsed.hostname.toLowerCase()
  if (VIDEO_HOST_TOKENS.some((token) => hostname.includes(token))) return "video"

  const pathname = parsed.pathname.toLowerCase()
  if (VIDEO_EXT_RE.test(pathname)) return "video"
  if (DOC_EXT_RE.test(pathname)) return "document"

  return "web"
}

export function normalizeReferenceLinkType(
  rawType: unknown,
  url: string,
): ShotReferenceLinkType {
  if (rawType === "web" || rawType === "video" || rawType === "document") return rawType
  return inferReferenceLinkType(url)
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null
}

function makeFallbackTitle(url: string): string {
  const parsed = safeUrl(url)
  if (!parsed) return "Reference link"
  return parsed.hostname || "Reference link"
}

export function normalizeReferenceLinks(raw: unknown): ReadonlyArray<ShotReferenceLink> {
  if (!Array.isArray(raw)) return []

  return raw
    .map((value, index): ShotReferenceLink | null => {
      if (!value || typeof value !== "object") return null
      const obj = value as Record<string, unknown>

      const url = normalizeReferenceLinkUrl(obj["url"])
      if (!url) return null

      const id = asString(obj["id"]) ?? `link-${index + 1}`
      const title = asString(obj["title"]) ?? makeFallbackTitle(url)
      const type = normalizeReferenceLinkType(obj["type"], url)

      return { id, title, url, type }
    })
    .filter((entry): entry is ShotReferenceLink => entry !== null)
}

