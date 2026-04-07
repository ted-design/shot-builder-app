// ---------------------------------------------------------------------------
// Advanced filter condition types & metadata
// ---------------------------------------------------------------------------

export type FilterField =
  | "status"
  | "tag"
  | "talent"
  | "location"
  | "product"
  | "missing"
  | "launchDate"
  | "hasRequirements"
  | "hasHeroImage"

export type SetOperator = "in" | "notIn"
export type BooleanOperator = "eq"
export type DateOperator = "before" | "after" | "between" | "empty"
export type FilterOperator = SetOperator | BooleanOperator | DateOperator

export type SetValue = readonly string[]
export type BooleanValue = boolean
export type SingleDateValue = string // YYYY-MM-DD
export type DateRangeValue = { readonly from: string; readonly to: string }
export type EmptyValue = null
export type FilterValue = SetValue | BooleanValue | SingleDateValue | DateRangeValue | EmptyValue

export interface FilterCondition {
  readonly id: string
  readonly field: FilterField
  readonly operator: FilterOperator
  readonly value: FilterValue
}

// ---------------------------------------------------------------------------
// Field metadata
// ---------------------------------------------------------------------------

export type FieldType = "set" | "boolean" | "date"

export interface FilterFieldMeta {
  readonly field: FilterField
  readonly label: string
  readonly type: FieldType
  readonly operators: readonly FilterOperator[]
  readonly defaultOperator: FilterOperator
}

export const FILTER_FIELD_META: readonly FilterFieldMeta[] = [
  { field: "status", label: "Status", type: "set", operators: ["in", "notIn"], defaultOperator: "in" },
  { field: "tag", label: "Tag", type: "set", operators: ["in", "notIn"], defaultOperator: "in" },
  { field: "talent", label: "Talent", type: "set", operators: ["in", "notIn"], defaultOperator: "in" },
  { field: "location", label: "Location", type: "set", operators: ["in", "notIn"], defaultOperator: "in" },
  { field: "product", label: "Product", type: "set", operators: ["in", "notIn"], defaultOperator: "in" },
  { field: "missing", label: "Missing", type: "set", operators: ["in"], defaultOperator: "in" },
  { field: "launchDate", label: "Launch Date", type: "date", operators: ["before", "after", "between", "empty"], defaultOperator: "before" },
  { field: "hasRequirements", label: "Has Requirements", type: "boolean", operators: ["eq"], defaultOperator: "eq" },
  { field: "hasHeroImage", label: "Has Hero Image", type: "boolean", operators: ["eq"], defaultOperator: "eq" },
] as const

export const FILTER_FIELD_BY_KEY: ReadonlyMap<FilterField, FilterFieldMeta> = new Map(
  FILTER_FIELD_META.map((m) => [m.field, m]),
)

// ---------------------------------------------------------------------------
// Operator display labels
// ---------------------------------------------------------------------------

export const OPERATOR_LABELS: Readonly<Record<FilterOperator, string>> = {
  in: "is",
  notIn: "is not",
  eq: "is",
  before: "is before",
  after: "is on or after",
  between: "is between",
  empty: "has no value",
}
