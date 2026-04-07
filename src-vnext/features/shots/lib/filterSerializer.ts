import type { FilterCondition, FilterField, FilterOperator, FilterValue, DateRangeValue } from "./filterConditions"
import { FILTER_FIELD_BY_KEY } from "./filterConditions"

// ---------------------------------------------------------------------------
// Serialize filter conditions to URL param string
// ---------------------------------------------------------------------------

/**
 * Encode a FilterValue to a URL-safe string segment.
 *
 * - Set (string[]): comma-separated IDs
 * - Boolean: "true" / "false"
 * - Date range: "YYYY-MM-DD~YYYY-MM-DD"
 * - Single date: "YYYY-MM-DD"
 * - Empty (null): empty string
 */
function encodeValue(value: FilterValue): string {
  if (value === null) return ""
  if (typeof value === "boolean") return String(value)
  if (Array.isArray(value)) return (value as readonly string[]).join(",")
  if (typeof value === "object" && "from" in value && "to" in value) {
    const range = value as DateRangeValue
    return `${range.from}~${range.to}`
  }
  return String(value)
}

/**
 * Decode a raw string segment back into the appropriate FilterValue
 * based on the field's type metadata.
 */
function decodeValue(raw: string, field: FilterField, operator: FilterOperator): FilterValue {
  if (operator === "empty") return null

  const meta = FILTER_FIELD_BY_KEY.get(field)
  if (!meta) return null

  switch (meta.type) {
    case "set": {
      if (!raw) return [] as readonly string[]
      return raw.split(",").filter(Boolean) as readonly string[]
    }
    case "boolean":
      return raw === "true"
    case "date": {
      if (operator === "between") {
        const parts = raw.split("~")
        return { from: parts[0] ?? "", to: parts[1] ?? "" } as DateRangeValue
      }
      return raw // single date string
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Serialize an array of filter conditions into a compact URL param string.
 *
 * Format: `field.operator:value;field.operator:value`
 */
export function serializeFilters(conditions: readonly FilterCondition[]): string {
  if (conditions.length === 0) return ""
  return conditions
    .map((c) => `${c.field}.${c.operator}:${encodeValue(c.value)}`)
    .join(";")
}

function makeId(): string {
  return crypto.randomUUID()
}

/**
 * Deserialize a URL param string back into filter conditions.
 *
 * Returns an empty array for null, empty, or malformed input.
 */
export function deserializeFilters(raw: string | null): readonly FilterCondition[] {
  if (!raw || !raw.trim()) return []

  const result: FilterCondition[] = []

  for (const segment of raw.split(";")) {
    const colonIdx = segment.indexOf(":")
    if (colonIdx === -1) continue

    const key = segment.slice(0, colonIdx)
    const rawValue = segment.slice(colonIdx + 1)

    const dotIdx = key.indexOf(".")
    if (dotIdx === -1) continue

    const field = key.slice(0, dotIdx) as FilterField
    const operator = key.slice(dotIdx + 1) as FilterOperator

    const meta = FILTER_FIELD_BY_KEY.get(field)
    if (!meta) continue
    if (!meta.operators.includes(operator)) continue

    const value = decodeValue(rawValue, field, operator)
    result.push({ id: makeId(), field, operator, value })
  }

  return result
}

// ---------------------------------------------------------------------------
// Legacy migration
// ---------------------------------------------------------------------------

/**
 * Convert legacy individual URL params (status, talent, location, product,
 * tag, missing) into FilterCondition[].
 *
 * Returns `null` if the `filters` param already exists (no migration needed).
 */
export function migrateLegacyParams(searchParams: URLSearchParams): readonly FilterCondition[] | null {
  if (searchParams.has("filters")) return null

  const conditions: FilterCondition[] = []

  const statusCsv = searchParams.get("status")
  if (statusCsv) {
    const statuses = statusCsv.split(",").filter(Boolean)
    if (statuses.length > 0) {
      conditions.push({ id: makeId(), field: "status", operator: "in", value: statuses })
    }
  }

  const talentId = searchParams.get("talent")
  if (talentId?.trim()) {
    conditions.push({ id: makeId(), field: "talent", operator: "in", value: [talentId.trim()] })
  }

  const locationId = searchParams.get("location")
  if (locationId?.trim()) {
    conditions.push({ id: makeId(), field: "location", operator: "in", value: [locationId.trim()] })
  }

  const productId = searchParams.get("product")
  if (productId?.trim()) {
    conditions.push({ id: makeId(), field: "product", operator: "in", value: [productId.trim()] })
  }

  const tagCsv = searchParams.get("tag")
  if (tagCsv) {
    const tagIds = tagCsv.split(",").filter(Boolean)
    if (tagIds.length > 0) {
      conditions.push({ id: makeId(), field: "tag", operator: "in", value: tagIds })
    }
  }

  const missingCsv = searchParams.get("missing")
  if (missingCsv) {
    const keys = missingCsv.split(",").filter(Boolean)
    if (keys.length > 0) {
      conditions.push({ id: makeId(), field: "missing", operator: "in", value: keys })
    }
  }

  return conditions.length > 0 ? conditions : null
}
