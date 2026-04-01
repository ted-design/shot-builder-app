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
    // Only replace if the token exists to avoid unnecessary string allocations
    if (resolved.includes(token)) {
      resolved = resolved.split(token).join(variable.value)
    }
  }
  return resolved
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
