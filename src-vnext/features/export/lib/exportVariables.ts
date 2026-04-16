import type { ExportVariable } from "../types/exportBuilder"

interface VariableContext {
  readonly projectName?: string
  readonly clientName?: string
  readonly shootDates?: readonly string[]
  readonly shotCount?: number
  readonly productCount?: number
}

/** Build the list of dynamic variables from project and shot data */
export function getDynamicVariables(context: VariableContext): readonly ExportVariable[] {
  const today = new Date()
  const formattedDate = today.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const shootDateRange = formatShootDates(context.shootDates)

  return [
    {
      key: "projectName",
      label: "Project Name",
      value: context.projectName ?? "",
      source: "dynamic",
    },
    {
      key: "clientName",
      label: "Client",
      value: context.clientName ?? "",
      source: "dynamic",
    },
    {
      key: "shootDates",
      label: "Shoot Dates",
      value: shootDateRange,
      source: "dynamic",
    },
    {
      key: "currentDate",
      label: "Current Date",
      value: formattedDate,
      source: "dynamic",
    },
    {
      key: "pageNumber",
      label: "Page Number",
      value: "{{pageNumber}}",
      source: "dynamic",
    },
    {
      key: "pageCount",
      label: "Page Count",
      value: "{{pageCount}}",
      source: "dynamic",
    },
    {
      key: "shotCount",
      label: "Shot Count",
      value: String(context.shotCount ?? 0),
      source: "dynamic",
    },
    {
      key: "productCount",
      label: "Product Count",
      value: String(context.productCount ?? 0),
      source: "dynamic",
    },
  ]
}

/** Replace all {{variableKey}} tokens in text with their resolved values */
export function resolveVariables(
  text: string,
  variables: readonly ExportVariable[],
): string {
  let resolved = text
  for (const variable of variables) {
    const token = `{{${variable.key}}}`
    if (resolved.includes(token)) {
      resolved = resolved.split(token).join(variable.value)
    }
  }
  return resolved
}

const PDF_RENDER_TIME_TOKENS = new Set(["pageNumber", "pageCount"])

/** Find all {{token}} keys in text that don't match any known variable */
export function findUnresolvedTokens(
  text: string,
  variables: readonly ExportVariable[],
): readonly string[] {
  const knownKeys = new Set(variables.map((v) => v.key))
  const tokenPattern = /\{\{(\w+)\}\}/g
  const unresolved: string[] = []
  const seen = new Set<string>()

  let match: RegExpExecArray | null
  while ((match = tokenPattern.exec(text)) !== null) {
    const key = match[1]
    if (!key) continue
    if (!knownKeys.has(key) && !PDF_RENDER_TIME_TOKENS.has(key) && !seen.has(key)) {
      seen.add(key)
      unresolved.push(key)
    }
  }

  return unresolved
}

function formatShootDates(dates?: readonly string[]): string {
  if (!dates || dates.length === 0) return ""
  if (dates.length === 1) return formatDateString(dates[0] ?? "")

  const sorted = [...dates].sort()
  const first = sorted[0] ?? ""
  const last = sorted[sorted.length - 1] ?? ""

  return `${formatDateString(first)} – ${formatDateString(last)}`
}

function formatDateString(dateStr: string): string {
  if (!dateStr) return ""
  // Parse YYYY-MM-DD without timezone shift
  const [year, month, day] = dateStr.split("-")
  if (!year || !month || !day) return dateStr

  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
