import type React from "react"

interface NotesPreviewTextProps {
  readonly text: string
  readonly className?: string
  readonly onLinkClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
}

type NotesToken =
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "url"; readonly value: string; readonly href: string }

const URL_REGEX = /((?:https?:\/\/|www\.)[^\s]+)/gi
const TRAILING_PUNCTUATION_REGEX = /[),.;!?]+$/

function normalizeHref(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`
}

function tokenizeNotesText(input: string): ReadonlyArray<NotesToken> {
  if (!input) return []
  const tokens: NotesToken[] = []
  let cursor = 0
  URL_REGEX.lastIndex = 0

  for (const match of input.matchAll(URL_REGEX)) {
    const index = match.index ?? -1
    if (index < cursor) continue
    const raw = match[0] ?? ""
    if (!raw) continue

    if (index > cursor) {
      tokens.push({ kind: "text", value: input.slice(cursor, index) })
    }

    const trimmedUrl = raw.replace(TRAILING_PUNCTUATION_REGEX, "")
    if (trimmedUrl.length > 0) {
      tokens.push({
        kind: "url",
        value: trimmedUrl,
        href: normalizeHref(trimmedUrl),
      })
    }

    const trailing = raw.slice(trimmedUrl.length)
    if (trailing) {
      tokens.push({ kind: "text", value: trailing })
    }

    cursor = index + raw.length
  }

  if (cursor < input.length) {
    tokens.push({ kind: "text", value: input.slice(cursor) })
  }

  return tokens
}

export function NotesPreviewText({
  text,
  className,
  onLinkClick,
}: NotesPreviewTextProps) {
  const tokens = tokenizeNotesText(text)

  if (tokens.length === 0) return null

  return (
    <span className={className}>
      {tokens.map((token, index) => {
        if (token.kind === "text") {
          return (
            <span key={`text-${index}`}>{token.value}</span>
          )
        }
        return (
          <a
            key={`url-${index}`}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-[var(--color-border-strong)] underline-offset-2 hover:text-[var(--color-text)]"
            onClick={onLinkClick}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {token.value}
          </a>
        )
      })}
    </span>
  )
}
