import { useMemo } from "react"
import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import { usersPath } from "@/shared/lib/paths"
import type { Role } from "@/shared/types"

interface UserDoc {
  readonly id: string
  readonly displayName?: string | null
  readonly email?: string | null
  readonly role?: Role
}

interface RecipientPickerProps {
  readonly clientId: string
  readonly value: readonly string[]
  readonly onChange: (uids: string[]) => void
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase()
    }
    return name.trim()[0]!.toUpperCase()
  }
  if (email) {
    return email[0]!.toUpperCase()
  }
  return "?"
}

function getDisplayName(user: UserDoc): string {
  if (user.displayName && user.displayName.trim().length > 0) {
    return user.displayName.trim()
  }
  return user.email ?? user.id
}

export function RecipientPicker({ clientId, value, onChange }: RecipientPickerProps) {
  const { data: allUsers, loading } = useFirestoreCollection<UserDoc>(
    usersPath(clientId),
  )

  const eligibleUsers = useMemo(
    () => allUsers.filter((u) => u.role === "admin" || u.role === "producer"),
    [allUsers],
  )

  const selectedSet = useMemo(() => new Set(value), [value])

  const handleToggle = (uid: string) => {
    if (selectedSet.has(uid)) {
      onChange(Array.from(selectedSet).filter((id) => id !== uid))
    } else {
      onChange([...Array.from(selectedSet), uid])
    }
  }

  const handleSelectAll = () => {
    onChange(eligibleUsers.map((u) => u.id))
  }

  const handleClearAll = () => {
    onChange([])
  }

  const allSelected = eligibleUsers.length > 0 && eligibleUsers.every((u) => selectedSet.has(u.id))

  const helpText = useMemo(() => {
    if (value.length === 0) return "Leave unchecked to notify all team leads"
    const names = eligibleUsers
      .filter((u) => selectedSet.has(u.id))
      .map(getDisplayName)
    if (names.length === 0) return "Leave unchecked to notify all team leads"
    return `Notifying ${names.join(", ")} only`
  }, [value, eligibleUsers, selectedSet])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-text)]">Notify</span>
        </div>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 w-7 animate-pulse rounded-full bg-[var(--color-surface-subtle)]"
            />
          ))}
        </div>
      </div>
    )
  }

  if (eligibleUsers.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        No team leads available to notify.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--color-text)]">Notify</span>
        <button
          type="button"
          className="text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          onClick={allSelected ? handleClearAll : handleSelectAll}
        >
          {allSelected ? "Clear All" : "Select All"}
        </button>
      </div>

      <div className="flex max-h-[120px] flex-wrap gap-2 overflow-y-auto">
        {eligibleUsers.map((user) => {
          const selected = selectedSet.has(user.id)
          const initials = getInitials(user.displayName, user.email)
          const displayName = getDisplayName(user)

          return (
            <button
              key={user.id}
              type="button"
              title={displayName}
              onClick={() => handleToggle(user.id)}
              aria-pressed={selected}
              aria-label={`${selected ? "Remove" : "Add"} ${displayName}`}
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-2xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] ${
                selected
                  ? "bg-[var(--color-text)] text-[var(--color-surface)] ring-2 ring-[var(--color-text)] ring-offset-1"
                  : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {initials}
            </button>
          )
        })}
      </div>

      <p className="text-xs text-[var(--color-text-subtle)]">{helpText}</p>
    </div>
  )
}
