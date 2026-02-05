import { useMemo, useState } from "react"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { formatShootDate } from "@/features/projects/lib/shootDates"

interface ShootDatesFieldProps {
  readonly value: readonly string[]
  readonly onChange: (next: string[]) => void
  readonly disabled?: boolean
}

export function ShootDatesField({
  value,
  onChange,
  disabled = false,
}: ShootDatesFieldProps) {
  const [draft, setDraft] = useState("")

  const sorted = useMemo(() => [...value].slice().sort(), [value])

  const addDraft = () => {
    const next = draft.trim()
    if (!next) return
    if (sorted.includes(next)) return
    onChange([...sorted, next].sort())
    setDraft("")
  }

  const remove = (date: string) => {
    onChange(sorted.filter((d) => d !== date))
  }

  return (
    <div className="flex flex-col gap-2">
      {sorted.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {sorted.map((d) => (
            <Badge
              key={d}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => remove(d)}
              title={`${d} (click to remove)`}
            >
              {formatShootDate(d)} &times;
            </Badge>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addDraft}
          disabled={disabled || !draft.trim() || sorted.includes(draft.trim())}
        >
          Add
        </Button>
      </div>
    </div>
  )
}

