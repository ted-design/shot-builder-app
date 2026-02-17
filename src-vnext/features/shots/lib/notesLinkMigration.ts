import type { ShotReferenceLink } from "@/shared/types"
import { inferReferenceLinkType, normalizeReferenceLinkUrl } from "@/features/shots/lib/referenceLinks"

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/gi
const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/

function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX)
  if (!matches) return []
  return matches
    .map((raw) => raw.replace(TRAILING_PUNCTUATION_REGEX, ""))
    .filter(Boolean)
}

function titleFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./i, "")
    return host || "Reference link"
  } catch {
    return "Reference link"
  }
}

function makeSuggestionId(index: number): string {
  return `notes-link-${index + 1}`
}

export function extractReferenceLinkSuggestionsFromNotes(args: {
  readonly notesAddendum: string | null | undefined
  readonly existingLinks: ReadonlyArray<ShotReferenceLink> | null | undefined
}): ReadonlyArray<ShotReferenceLink> {
  const { notesAddendum, existingLinks } = args
  const source = typeof notesAddendum === "string" ? notesAddendum.trim() : ""
  if (!source) return []

  const existing = new Set(
    (existingLinks ?? [])
      .map((entry) => entry.url.trim().toLowerCase())
      .filter(Boolean),
  )

  const seen = new Set<string>()
  const suggestions: ShotReferenceLink[] = []

  for (const [index, candidate] of extractUrls(source).entries()) {
    const normalized = normalizeReferenceLinkUrl(candidate)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (existing.has(key) || seen.has(key)) continue
    seen.add(key)

    suggestions.push({
      id: makeSuggestionId(index),
      title: titleFromUrl(normalized),
      url: normalized,
      type: inferReferenceLinkType(normalized),
    })
  }

  return suggestions
}

