import { Checkbox } from "@/ui/checkbox"
import { Switch } from "@/ui/switch"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { STATUS_LABELS } from "../lib/shotListFilters"
import type {
  FilterCondition,
  FilterValue,
  DateRangeValue,
} from "../lib/filterConditions"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FilterValuePickerProps {
  readonly condition: FilterCondition
  readonly onChange: (value: FilterValue) => void
  readonly statusOptions: readonly { value: string; label: string }[]
  readonly tagOptions: readonly { id: string; label: string }[]
  readonly talentRecords: readonly { id: string; name: string }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MISSING_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "products", label: "Products" },
  { value: "talent", label: "Talent" },
  { value: "location", label: "Location" },
  { value: "image", label: "Hero Image" },
]

function asStringArray(value: FilterValue): readonly string[] {
  if (Array.isArray(value)) return value as readonly string[]
  return []
}

function toggleInArray(arr: readonly string[], item: string): readonly string[] {
  if (arr.includes(item)) return arr.filter((v) => v !== item)
  return [...arr, item]
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CheckboxList({
  options,
  selected,
  onChange,
}: {
  readonly options: readonly { value: string; label: string }[]
  readonly selected: readonly string[]
  readonly onChange: (next: readonly string[]) => void
}) {
  return (
    <div className="max-h-44 space-y-1.5 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
      {options.length === 0 ? (
        <p className="text-xs text-[var(--color-text-subtle)]">No options available</p>
      ) : (
        options.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(opt.value)}
              onCheckedChange={(v) => {
                if (v === "indeterminate") return
                onChange(toggleInArray(selected, opt.value))
              }}
            />
            <span className="truncate">{opt.label}</span>
          </label>
        ))
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Set pickers
// ---------------------------------------------------------------------------

function StatusPicker({ condition, onChange }: { readonly condition: FilterCondition; readonly onChange: (v: FilterValue) => void }) {
  const selected = asStringArray(condition.value)
  const options = (["todo", "in_progress", "on_hold", "complete"] as const).map((s) => ({
    value: s,
    label: STATUS_LABELS[s],
  }))
  return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
}

function MissingPicker({ condition, onChange }: { readonly condition: FilterCondition; readonly onChange: (v: FilterValue) => void }) {
  const selected = asStringArray(condition.value)
  return <CheckboxList options={MISSING_OPTIONS} selected={[...selected]} onChange={onChange} />
}

function TagPicker({
  condition,
  onChange,
  tagOptions,
}: {
  readonly condition: FilterCondition
  readonly onChange: (v: FilterValue) => void
  readonly tagOptions: readonly { id: string; label: string }[]
}) {
  const selected = asStringArray(condition.value)
  const options = tagOptions.map((t) => ({ value: t.id, label: t.label }))
  return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
}

function TalentPicker({
  condition,
  onChange,
  talentRecords,
}: {
  readonly condition: FilterCondition
  readonly onChange: (v: FilterValue) => void
  readonly talentRecords: readonly { id: string; name: string }[]
}) {
  const selected = asStringArray(condition.value)
  const options = talentRecords.map((t) => ({ value: t.id, label: t.name }))
  return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
}

function LocationPicker({
  condition,
  onChange,
  locationRecords,
}: {
  readonly condition: FilterCondition
  readonly onChange: (v: FilterValue) => void
  readonly locationRecords: readonly { id: string; name: string }[]
}) {
  const selected = asStringArray(condition.value)
  const options = locationRecords.map((l) => ({ value: l.id, label: l.name }))
  return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
}

function ProductPicker({
  condition,
  onChange,
  productFamilies,
}: {
  readonly condition: FilterCondition
  readonly onChange: (v: FilterValue) => void
  readonly productFamilies: readonly { id: string; styleName: string }[]
}) {
  const selected = asStringArray(condition.value)
  const options = productFamilies.map((p) => ({ value: p.id, label: p.styleName }))
  return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
}

// ---------------------------------------------------------------------------
// Boolean picker
// ---------------------------------------------------------------------------

function BooleanPicker({ condition, onChange }: { readonly condition: FilterCondition; readonly onChange: (v: FilterValue) => void }) {
  const isTrue = condition.value === true
  return (
    <div className="flex items-center gap-2">
      <Switch checked={isTrue} onCheckedChange={(checked) => onChange(checked)} />
      <Label className="text-sm text-[var(--color-text-muted)]">{isTrue ? "Yes" : "No"}</Label>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date picker
// ---------------------------------------------------------------------------

function DatePicker({ condition, onChange }: { readonly condition: FilterCondition; readonly onChange: (v: FilterValue) => void }) {
  if (condition.operator === "empty") {
    return (
      <p className="text-xs text-[var(--color-text-subtle)]">No launch date</p>
    )
  }

  if (condition.operator === "between") {
    const range = (typeof condition.value === "object" && condition.value !== null && "from" in condition.value)
      ? condition.value as DateRangeValue
      : { from: "", to: "" }
    return (
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={range.from}
          className="h-8 w-[140px] text-sm"
          onChange={(e) => onChange({ from: e.target.value, to: range.to })}
        />
        <span className="text-xs text-[var(--color-text-subtle)]">to</span>
        <Input
          type="date"
          value={range.to}
          className="h-8 w-[140px] text-sm"
          onChange={(e) => onChange({ from: range.from, to: e.target.value })}
        />
      </div>
    )
  }

  // before / after — single date
  const dateValue = typeof condition.value === "string" ? condition.value : ""
  return (
    <Input
      type="date"
      value={dateValue}
      className="h-8 w-[160px] text-sm"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FilterValuePicker({
  condition,
  onChange,
  tagOptions,
  talentRecords,
  locationRecords,
  productFamilies,
}: FilterValuePickerProps) {
  switch (condition.field) {
    case "status":
      return <StatusPicker condition={condition} onChange={onChange} />
    case "tag":
      return <TagPicker condition={condition} onChange={onChange} tagOptions={tagOptions} />
    case "missing":
      return <MissingPicker condition={condition} onChange={onChange} />
    case "talent":
      return <TalentPicker condition={condition} onChange={onChange} talentRecords={talentRecords} />
    case "location":
      return <LocationPicker condition={condition} onChange={onChange} locationRecords={locationRecords} />
    case "product":
      return <ProductPicker condition={condition} onChange={onChange} productFamilies={productFamilies} />
    case "hasRequirements":
    case "hasHeroImage":
      return <BooleanPicker condition={condition} onChange={onChange} />
    case "launchDate":
      return <DatePicker condition={condition} onChange={onChange} />
    default:
      return null
  }
}
