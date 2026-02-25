import { useMemo, useState } from "react"
import { Tag as TagIcon, Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { TagBadge } from "@/shared/components/TagBadge"
import { TagColorPicker } from "@/shared/components/TagColorPicker"
import { useAvailableTags } from "@/features/shots/hooks/useAvailableTags"
import type { ShotTag, ShotTagCategory } from "@/shared/types"
import type { TagColorKey } from "@/shared/lib/tagColors"
import { getShotTagCategoryLabel, resolveShotTagCategory } from "@/shared/lib/tagCategories"

function normalizeLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function newTagId(): string {
  return `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function TagEditor({
  tags,
  onSave,
  disabled,
}: {
  readonly tags: readonly ShotTag[]
  readonly onSave: (next: readonly ShotTag[]) => Promise<boolean>
  readonly disabled?: boolean
}) {
  const { tags: available } = useAvailableTags()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<ShotTag[]>([])
  const [saving, setSaving] = useState(false)
  const [createLabel, setCreateLabel] = useState("")
  const [createColor, setCreateColor] = useState<TagColorKey>("blue")
  const [createCategory, setCreateCategory] = useState<ShotTagCategory>("other")

  const normalizedCreateLabel = normalizeLabel(createLabel)
  const normalizedCreateKey = normalizedCreateLabel.toLowerCase()

  const availableByLabel = useMemo(() => {
    const map = new Map<string, ShotTag>()
    for (const t of available) {
      map.set(t.label.trim().toLowerCase(), {
        id: t.id,
        label: t.label,
        color: t.color,
        category: resolveShotTagCategory(t),
      })
    }
    return map
  }, [available])

  const existingLabelConflict = useMemo(() => {
    if (!normalizedCreateKey) return false
    return draft.some((t) => t.label.trim().toLowerCase() === normalizedCreateKey)
  }, [draft, normalizedCreateKey])

  const filtered = useMemo(() => {
    const q = normalizedCreateKey
    return available
      .filter((t) => (!q ? true : t.label.toLowerCase().includes(q)))
      .map((t) => ({
        id: t.id,
        label: t.label,
        color: t.color,
        category: resolveShotTagCategory(t),
      }))
  }, [available, normalizedCreateKey])

  const toggle = (tag: ShotTag) => {
    setDraft((prev) => (prev.some((t) => t.id === tag.id) ? prev.filter((t) => t.id !== tag.id) : [...prev, tag]))
  }

  const handleOpenChange = (next: boolean) => {
    if (disabled) return
    setOpen(next)
    if (next) {
      setDraft(tags.slice())
      setCreateLabel("")
      setCreateColor("blue")
      setCreateCategory("other")
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      const ok = await onSave(draft)
      if (ok) setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const createOrReuse = () => {
    if (!normalizedCreateLabel || existingLabelConflict) return

    const reuse = availableByLabel.get(normalizedCreateKey) ?? null
    if (reuse) {
      toggle(reuse)
      setCreateLabel("")
      setCreateColor("blue")
      setCreateCategory("other")
      return
    }

    const next: ShotTag = {
      id: newTagId(),
      label: normalizedCreateLabel,
      color: createColor,
      category: createCategory,
    }
    toggle(next)
    setCreateLabel("")
    setCreateColor("blue")
    setCreateCategory("other")
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-auto min-h-[2.5rem] w-full justify-start text-left font-normal"
          disabled={disabled}
        >
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <TagBadge key={t.id} tag={t} />
              ))}
            </div>
          ) : (
            <span className="flex items-center gap-2 text-[var(--color-text-subtle)]">
              <TagIcon className="h-4 w-4" />
              Add tags…
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="start">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
              Tags
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">
              {draft.length} selected
            </div>
          </div>
        </div>

        <div className="px-3 pb-3">
          {normalizedCreateLabel ? (
            <div className="mb-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-[var(--color-text)]">
                    {availableByLabel.has(normalizedCreateKey)
                      ? "Add existing tag"
                      : "Create new tag"}
                  </div>
                  <div className="truncate text-2xs text-[var(--color-text-muted)]">
                    {normalizedCreateLabel}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <TagColorPicker value={createColor} onChange={setCreateColor} size="sm" />
                  <Select
                    value={createCategory}
                    onValueChange={(next) => setCreateCategory(next as ShotTagCategory)}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priority">
                        {getShotTagCategoryLabel("priority")}
                      </SelectItem>
                      <SelectItem value="gender">
                        {getShotTagCategoryLabel("gender")}
                      </SelectItem>
                      <SelectItem value="media">
                        {getShotTagCategoryLabel("media")}
                      </SelectItem>
                      <SelectItem value="other">
                        {getShotTagCategoryLabel("other")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    disabled={saving || existingLabelConflict}
                    onClick={createOrReuse}
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    {availableByLabel.has(normalizedCreateKey) ? "Add" : "Create"}
                  </Button>
                </div>
              </div>
              {existingLabelConflict ? (
                <div className="mt-2 text-xs text-[var(--color-error)]">
                  This tag is already on the shot.
                </div>
              ) : null}
            </div>
          ) : null}

          <Command className="w-full">
            <CommandInput
              value={createLabel}
              onValueChange={setCreateLabel}
              placeholder="Search or create…"
            />
            <CommandList>
              <CommandEmpty>No matches.</CommandEmpty>
              <CommandGroup heading="Available">
                {filtered.map((t) => (
                  <CommandItem
                    key={t.id}
                    data-testid={`tag-option-${t.id}`}
                    onSelect={() => toggle(t)}
                    className="flex items-center gap-2"
                  >
                    <Checkbox checked={draft.some((d) => d.id === t.id)} />
                    <div className="min-w-0">
                      <TagBadge tag={t} />
                      <div className="mt-1 text-2xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                        {getShotTagCategoryLabel(resolveShotTagCategory(t))}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] p-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => {
              save()
            }}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
