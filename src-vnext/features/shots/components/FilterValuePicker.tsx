import { useState } from "react"
import { Checkbox } from "@/ui/checkbox"
import { Switch } from "@/ui/switch"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { isFeatureEnabled } from "@/shared/lib/flags"
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
  readonly talentRecords: readonly { id: string; name: string; projectIds?: readonly string[] }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
  readonly projectId: string
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

function TalentGroup({
  label,
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  readonly label: string
  readonly options: readonly { id: string; name: string }[]
  readonly selected: readonly string[]
  readonly onToggle: (id: string) => void
  readonly emptyHint: string
}) {
  return (
    <div className="space-y-1.5">
      <p className="px-1 text-2xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">{label}</p>
      {options.length === 0 ? (
        <p className="px-1 text-xs text-[var(--color-text-subtle)]">{emptyHint}</p>
      ) : (
        options.map((t) => (
          <label key={t.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={selected.includes(t.id)}
              onCheckedChange={(v) => {
                if (v === "indeterminate") return
                onToggle(t.id)
              }}
            />
            <span className="truncate">{t.name}</span>
          </label>
        ))
      )}
    </div>
  )
}

function TalentPicker({
  condition,
  onChange,
  talentRecords,
  projectId,
}: {
  readonly condition: FilterCondition
  readonly onChange: (v: FilterValue) => void
  readonly talentRecords: readonly { id: string; name: string; projectIds?: readonly string[] }[]
  readonly projectId: string
}) {
  const [query, setQuery] = useState("")
  const selected = asStringArray(condition.value)

  if (!isFeatureEnabled("featureShotFilterTalentScope")) {
    const options = talentRecords.map((t) => ({ value: t.id, label: t.name }))
    return <CheckboxList options={options} selected={[...selected]} onChange={onChange} />
  }

  const onToggle = (id: string) => onChange(toggleInArray(selected, id))

  const q = query.trim().toLowerCase()
  const matches = (name: string) => q === "" || name.toLowerCase().includes(q)
  const isProjectTalent = (t: { projectIds?: readonly string[] }) => t.projectIds?.includes(projectId) ?? false

  const projectTalent = talentRecords.filter((t) => isProjectTalent(t) && matches(t.name))
  const otherTalent = talentRecords.filter((t) => !isProjectTalent(t) && matches(t.name))

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search talent…"
        className="h-8 text-sm"
        aria-label="Search talent"
      />
      <div className="max-h-44 space-y-2.5 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
        <TalentGroup
          label="Project talent"
          options={projectTalent}
          selected={selected}
          onToggle={onToggle}
          emptyHint={q === "" ? "No talent assigned to this project" : "No project talent matches"}
        />
        {q === "" ? (
          <p className="px-1 text-xs text-[var(--color-text-subtle)]">Search to filter by other talent…</p>
        ) : (
          <TalentGroup
            label="All talent"
            options={otherTalent}
            selected={selected}
            onToggle={onToggle}
            emptyHint="No other talent matches"
          />
        )}
      </div>
    </div>
  )
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
  projectId,
}: FilterValuePickerProps) {
  switch (condition.field) {
    case "status":
      return <StatusPicker condition={condition} onChange={onChange} />
    case "tag":
      return <TagPicker condition={condition} onChange={onChange} tagOptions={tagOptions} />
    case "missing":
      return <MissingPicker condition={condition} onChange={onChange} />
    case "talent":
      return <TalentPicker condition={condition} onChange={onChange} talentRecords={talentRecords} projectId={projectId} />
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
