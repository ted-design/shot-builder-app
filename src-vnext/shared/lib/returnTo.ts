export interface ReturnToContext {
  readonly path: string
  readonly label: string
}

function deriveLabel(path: string): string {
  const withoutQuery = path.split(/[?#]/)[0] ?? ""
  const segments = withoutQuery.split("/").filter(Boolean)
  const last = segments[segments.length - 1] || "previous page"
  const clean = last.replace(/[-_]+/g, " ")
  return `Return to ${clean.charAt(0).toUpperCase()}${clean.slice(1)}`
}

export function safeInternalPath(value: string | null | undefined): string | null {
  if (!value) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(value)
  } catch {
    return null
  }

  if (!decoded.startsWith("/")) return null
  if (decoded.startsWith("//")) return null
  if (decoded.includes("://")) return null

  return decoded
}

export function parseReturnToParam(value: string | null | undefined): ReturnToContext | null {
  const path = safeInternalPath(value)
  if (!path) return null
  return { path, label: deriveLabel(path) }
}
